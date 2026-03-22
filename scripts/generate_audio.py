#!/usr/bin/env python3
"""
Generate audio from text prompts using Stable Audio Open.

This script loads the Stable Audio Open model and generates audio based on text prompts.
It supports optional parameters for seed, steps, and guidance scale.
"""

import argparse
import sys
import os
from pathlib import Path
from typing import Optional

try:
    import torch
    import torchaudio
    from einops import rearrange
    from stable_audio_tools import get_pretrained_model
    from stable_audio_tools.inference.generation import generate_diffusion_cond
except ImportError as e:
    print(f"Error: Missing required package. {e}", file=sys.stderr)
    print("Install with: pip install stable_audio_tools torchaudio torch einops", file=sys.stderr)
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

    if args.steps < 20 or args.steps > 200:
        print(f"Error: Steps must be between 20 and 200, got {args.steps}", file=sys.stderr)
        sys.exit(1)

    if args.guidance < 1 or args.guidance > 15:
        print(f"Error: Guidance must be between 1 and 15, got {args.guidance}", file=sys.stderr)
        sys.exit(1)

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Determine device
        device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}")
        print("Progress: 10%")

        # Load model
        print("Loading Stable Audio Open model...")
        model, model_config = get_pretrained_model("stabilityai/stable-audio-open-1.0")
        sample_rate = model_config["sample_rate"]
        sample_size = model_config["sample_size"]

        model = model.to(device)
        model.eval()
        print("Progress: 20%")

        # Set seed if provided
        if args.seed is not None:
            torch.manual_seed(args.seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed(args.seed)

        # Prepare conditioning
        conditioning = [{
            "prompt": args.prompt,
            "seconds_start": 0,
            "seconds_total": args.duration
        }]

        print(f"Generating audio: {args.prompt[:50]}...")
        print("Progress: 30%")

        # Generate audio
        with torch.no_grad():
            output = generate_diffusion_cond(
                model,
                steps=args.steps,
                cfg_scale=args.guidance,
                conditioning=conditioning,
                sample_size=sample_size,
                sigma_min=0.3,
                sigma_max=500,
                sampler_type="dpmpp-3m-sde",
                device=device,
            )

        print("Progress: 80%")

        # Rearrange output tensor
        output = rearrange(output, "b d n -> d (b n)")

        # Trim to exact duration
        target_samples = int(sample_rate * args.duration)
        if output.shape[1] > target_samples:
            output = output[:, :target_samples]
        elif output.shape[1] < target_samples:
            # Pad if necessary
            padding = target_samples - output.shape[1]
            output = torch.nn.functional.pad(output, (0, padding))

        # Normalize
        output_abs_max = output.abs().max()
        if output_abs_max > 0:
            output_norm = output / output_abs_max
        else:
            output_norm = output

        # Convert to int16 range and float32
        output_norm = output_norm.to(torch.float32).div(torch.iinfo(torch.int16).max)

        # Save to file
        torchaudio.save(str(output_path), output_norm.cpu(), sample_rate)

        print("Progress: 100%")
        print(f"OUTPUT: {output_path.absolute()}")
        sys.exit(0)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
