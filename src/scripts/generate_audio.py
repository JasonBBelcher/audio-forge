#!/usr/bin/env python3
"""
Stable Audio Open generation script for AudioForge.
Usage: generate_audio.py --prompt "..." --duration 10 --output out.wav [--seed 42] [--steps 100] [--guidance 7.0]
"""
import argparse
import sys
import os


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', required=True, help='Text prompt for audio generation')
    parser.add_argument('--duration', type=float, default=10.0, help='Duration in seconds')
    parser.add_argument('--output', required=True, help='Output file path')
    parser.add_argument('--seed', type=int, default=None, help='Random seed')
    parser.add_argument('--steps', type=int, default=100, help='Number of diffusion steps')
    parser.add_argument('--guidance', type=float, default=7.0, help='Guidance scale')
    args = parser.parse_args()

    try:
        import torch
        import torchaudio
        from stable_audio_tools import get_pretrained_model
        from stable_audio_tools.inference.generation import generate_diffusion_cond
    except ImportError as e:
        print(f'ERROR: Missing dependency: {e}', file=sys.stderr)
        sys.exit(1)

    print('Progress: 5% Loading model...', flush=True)

    model, model_config = get_pretrained_model('stabilityai/stable-audio-open-1.0')
    device = 'mps' if torch.backends.mps.is_available() else ('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    print('Progress: 15% Generating...', flush=True)

    # Generation with progress callback
    sample_rate = model_config['sample_rate']
    sample_size = int(sample_rate * args.duration)

    conditioning = [
        {
            'prompt': args.prompt,
            'seconds_start': 0,
            'seconds_total': args.duration,
        }
    ]

    generator = torch.Generator(device=device)
    if args.seed is not None:
        generator.manual_seed(args.seed)

    output = generate_diffusion_cond(
        model,
        steps=args.steps,
        cfg_scale=args.guidance,
        conditioning=conditioning,
        sample_size=sample_size,
        sigma_min=0.3,
        sigma_max=500,
        sampler_type='dpmpp-3m-sde',
        device=device,
        generator=generator,
    )

    print('Progress: 90% Saving...', flush=True)

    output = output.to(torch.float32).div(torch.max(torch.abs(output))).clamp(-1, 1).cpu()
    torchaudio.save(args.output, output, sample_rate)

    print('Progress: 100% Done', flush=True)
    print(f'OUTPUT: {args.output}', flush=True)


if __name__ == '__main__':
    main()
