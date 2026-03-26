#!/usr/bin/env python3
"""
Generate audio from text prompts using Stable Audio Open via HuggingFace diffusers.

Uses stabilityai/stable-audio-open-1.0 through the diffusers StableAudioPipeline.
Model weights (~3.3GB) are cached in ~/.cache/huggingface on first run.
"""

import argparse
import sys
import os
from pathlib import Path

try:
    import torch
    import soundfile as sf
    import numpy as np
    from diffusers import StableAudioPipeline
except ImportError as e:
    print(f"Error: Missing required package. {e}", file=sys.stderr)
    print("Install with: pip install diffusers transformers accelerate soundfile torch", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate audio from text using Stable Audio Open")
    parser.add_argument("--prompt", required=True, help="Text prompt for audio generation")
    parser.add_argument("--duration", type=float, required=True, help="Duration of generated audio in seconds")
    parser.add_argument("--output", required=True, help="Output file path for generated WAV")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--steps", type=int, default=100, help="Number of diffusion steps (20-200)")
    parser.add_argument("--guidance", type=float, default=7.0, help="Classifier-free guidance scale (1-15)")

    args = parser.parse_args()

    # Validate inputs
    if args.duration < 1 or args.duration > 47:
        print(f"Error: Duration must be between 1 and 47 seconds, got {args.duration}", file=sys.stderr)
        sys.exit(1)

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Determine device — prefer MPS on Apple Silicon, then CUDA, then CPU
        if torch.backends.mps.is_available():
            device = "mps"
        elif torch.cuda.is_available():
            device = "cuda"
        else:
            device = "cpu"

        print(f"Using device: {device}", flush=True)
        print("Progress: 5%", flush=True)

        # Load pipeline (cached after first download)
        print("Loading Stable Audio Open model (first run downloads ~3.3GB)...", flush=True)
        pipe = StableAudioPipeline.from_pretrained(
            "stabilityai/stable-audio-open-1.0",
            torch_dtype=torch.float16 if device != "cpu" else torch.float32,
        )
        pipe = pipe.to(device)
        print("Progress: 20%", flush=True)

        # Set seed
        generator = None
        if args.seed is not None:
            generator = torch.Generator(device=device).manual_seed(args.seed)

        print(f"Generating: {args.prompt[:60]}...", flush=True)
        print("Progress: 30%", flush=True)

        # Run inference
        audio = pipe(
            args.prompt,
            negative_prompt="low quality, average quality",
            num_inference_steps=args.steps,
            audio_end_in_s=args.duration,
            num_waveforms_per_prompt=1,
            generator=generator,
            guidance_scale=args.guidance,
        ).audios

        print("Progress: 85%", flush=True)

        # audio shape: (batch, channels, samples)
        audio_np = audio[0].T  # (samples, channels)

        # Get sample rate from pipeline config
        sample_rate = pipe.vae.config.sampling_rate if hasattr(pipe.vae.config, 'sampling_rate') else 44100

        # Normalize to [-1, 1]
        max_val = np.abs(audio_np).max()
        if max_val > 0:
            audio_np = audio_np / max_val

        # Save as WAV
        sf.write(str(output_path), audio_np, sample_rate, subtype='PCM_16')

        print("Progress: 100%", flush=True)
        print(f"OUTPUT: {output_path.absolute()}", flush=True)
        sys.exit(0)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
