#!/usr/bin/env python3
"""
Generate audio from text prompts using Stable Audio Open via HuggingFace diffusers.

Uses stabilityai/stable-audio-open-1.0 through the diffusers StableAudioPipeline.
Model weights (~3.3GB) are cached in ~/.cache/huggingface on first run.
"""

import argparse
import sys
import os
import threading
import time
from pathlib import Path

# CosineDPMSolverMultistepScheduler recurses deeply on MPS — raise limit aggressively.
sys.setrecursionlimit(1 << 20)

try:
    import torch
    import soundfile as sf
    import numpy as np
    from diffusers import StableAudioPipeline
    from diffusers.schedulers.scheduling_dpmsolver_sde import BrownianTreeNoiseSampler
except ImportError as e:
    print(f"Error: Missing required package. {e}", file=sys.stderr)
    print("Install with: pip install diffusers transformers accelerate soundfile torch", file=sys.stderr)
    sys.exit(1)


# ── Patch BrownianTreeNoiseSampler ────────────────────────────────────────────
# torchsde's BrownianInterval._split() recurses infinitely when called with a
# sigma value even slightly outside its [sigma_min, sigma_max] range (float32
# precision causes sigma_max to become 500.00006103... > 500.0).
# Fix: store the valid [t0, t1] range on init and clamp before every call.
_orig_btns_init = BrownianTreeNoiseSampler.__init__
_orig_btns_call = BrownianTreeNoiseSampler.__call__

def _patched_btns_init(self, x, sigma_min, sigma_max, seed=None, transform=lambda x: x):
    _orig_btns_init(self, x, sigma_min, sigma_max, seed=seed, transform=transform)
    t0 = self.transform(torch.as_tensor(sigma_min, dtype=torch.float64))
    t1 = self.transform(torch.as_tensor(sigma_max, dtype=torch.float64))
    self._valid_t_lo = float(min(t0, t1))
    self._valid_t_hi = float(max(t0, t1))

def _patched_btns_call(self, sigma, sigma_next):
    t0 = self.transform(torch.as_tensor(sigma))
    t1 = self.transform(torch.as_tensor(sigma_next))
    lo, hi = self._valid_t_lo, self._valid_t_hi
    t0 = t0.clamp(lo, hi)
    t1 = t1.clamp(lo, hi)
    denom = (t1 - t0).abs().sqrt()
    if denom == 0:
        return torch.zeros_like(sigma if isinstance(sigma, torch.Tensor) else t0)
    return self.tree(t0, t1) / denom

BrownianTreeNoiseSampler.__init__ = _patched_btns_init
BrownianTreeNoiseSampler.__call__ = _patched_btns_call
# ─────────────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Generate audio from text using Stable Audio Open")
    parser.add_argument("--prompt", required=True, help="Text prompt for audio generation")
    parser.add_argument("--duration", type=float, required=True, help="Duration of generated audio in seconds")
    parser.add_argument("--output", required=True, help="Output file path for generated WAV")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--steps", type=int, default=100, help="Number of diffusion steps (20-200)")
    parser.add_argument("--guidance", type=float, default=7.0, help="Classifier-free guidance scale (1-15)")
    parser.add_argument("--device", type=str, default=None, choices=["cpu", "cuda", "mps"], help="Force a specific torch device")

    args = parser.parse_args()

    # Validate inputs
    if args.duration < 1 or args.duration > 47:
        print(f"Error: Duration must be between 1 and 47 seconds, got {args.duration}", file=sys.stderr)
        sys.exit(1)

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Device selection — prefer CUDA > MPS > CPU.
        # The BrownianTreeNoiseSampler infinite-recursion bug is patched above,
        # so MPS is safe to use again on Apple Silicon.
        if args.device:
            device = args.device
        elif torch.cuda.is_available():
            device = "cuda"
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

        torch_dtype = torch.float16 if device == "cuda" else torch.float32

        print(f"Using device: {device}", flush=True)
        print("Progress: 5%", flush=True)

        _stop = threading.Event()
        def _heartbeat():
            pct = 6
            while not _stop.is_set():
                time.sleep(8)
                if not _stop.is_set():
                    # Keep emitting so the UI doesn't appear frozen; cap at 19
                    print(f"Progress: {min(pct, 19)}%", flush=True)
                    if pct < 19:
                        pct += 1

        _t = threading.Thread(target=_heartbeat, daemon=True)
        _t.start()
        try:
            print("Loading Stable Audio Open model (first run downloads ~3.3 GB)...", flush=True)
            pipe = StableAudioPipeline.from_pretrained(
                "stabilityai/stable-audio-open-1.0",
                torch_dtype=torch_dtype,
            )
        finally:
            _stop.set()
            _t.join(timeout=1)

        pipe = pipe.to(device)
        print("Progress: 20%", flush=True)

        # Set seed
        generator = None
        if args.seed is not None:
            generator = torch.Generator(device=device).manual_seed(args.seed)

        print(f"Generating: {args.prompt[:60]}...", flush=True)
        print("Progress: 30%", flush=True)

        # CosineDPMSolverMultistepScheduler (via torchsde) recurses deep enough to
        # exhaust the OS C-stack (~8 MB default), which sys.setrecursionlimit cannot
        # override. Running inference on a thread with a 256 MB stack fixes this.
        threading.stack_size(256 * 1024 * 1024)

        _audio_result: list = [None]
        _audio_error:  list = [None]

        def _run_inference():
            try:
                _audio_result[0] = pipe(
                    args.prompt,
                    negative_prompt="low quality, average quality",
                    num_inference_steps=args.steps,
                    audio_end_in_s=args.duration,
                    num_waveforms_per_prompt=1,
                    generator=generator,
                    guidance_scale=args.guidance,
                ).audios
            except Exception as exc:
                _audio_error[0] = exc

        # Heartbeat: tick 31→84% every 12 s while inference runs
        _inf_stop = threading.Event()
        def _inf_heartbeat():
            pct = 31
            while not _inf_stop.is_set():
                time.sleep(12)
                if not _inf_stop.is_set():
                    print(f"Progress: {min(pct, 84)}%", flush=True)
                    if pct < 84:
                        pct += 2

        _inf_t  = threading.Thread(target=_inf_heartbeat, daemon=True)
        _work_t = threading.Thread(target=_run_inference)
        _inf_t.start()
        _work_t.start()
        _work_t.join()
        _inf_stop.set()
        _inf_t.join(timeout=1)

        if _audio_error[0] is not None:
            raise _audio_error[0]

        audio = _audio_result[0]

        print("Progress: 85%", flush=True)

        # audio shape: (batch, channels, samples)
        # MPS tensors must be moved to CPU before numpy conversion
        audio_np = audio[0].cpu().float().numpy().T  # (samples, channels)

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
