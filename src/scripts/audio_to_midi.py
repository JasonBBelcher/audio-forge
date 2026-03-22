#!/usr/bin/env python3
"""
Audio to MIDI conversion using Basic Pitch.
Usage: audio_to_midi.py --input audio.wav --output-dir /out [--onset-threshold 0.5]
"""
import argparse
import sys
import os


def main():
    parser = argparse.ArgumentParser(
        description='Convert audio files to MIDI using Basic Pitch'
    )
    parser.add_argument('--input', required=True, help='Input audio file path')
    parser.add_argument(
        '--output-dir', required=True, help='Output directory for MIDI file'
    )
    parser.add_argument(
        '--onset-threshold',
        type=float,
        default=0.5,
        help='Onset threshold (0.0-1.0)',
    )
    parser.add_argument(
        '--frame-threshold',
        type=float,
        default=0.3,
        help='Frame threshold (0.0-1.0)',
    )
    parser.add_argument(
        '--minimum-note-length',
        type=int,
        default=58,
        help='Minimum note length in milliseconds',
    )
    parser.add_argument(
        '--minimum-frequency',
        type=float,
        help='Minimum frequency in Hz',
    )
    parser.add_argument(
        '--maximum-frequency',
        type=float,
        help='Maximum frequency in Hz',
    )
    parser.add_argument(
        '--no-infer-onsets',
        action='store_true',
        help='Disable onset inference',
    )
    parser.add_argument(
        '--max-polyphony',
        type=int,
        help='Maximum number of simultaneous notes',
    )

    args = parser.parse_args()

    try:
        from basic_pitch.inference import predict_and_save
        from basic_pitch import ICASSP_2022_MODEL_PATH
    except ImportError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    # Validate input file exists
    if not os.path.exists(args.input):
        print(f"ERROR: Input file does not exist: {args.input}", file=sys.stderr)
        sys.exit(1)

    # Create output directory if needed
    os.makedirs(args.output_dir, exist_ok=True)

    print("Progress: 10% Loading model...", file=sys.stdout)
    sys.stdout.flush()

    # Build kwargs for predict_and_save
    kwargs = {
        'save_midi': True,
        'sonify_midi': False,
        'save_model_outputs': False,
        'save_notes': False,
        'onset_threshold': args.onset_threshold,
        'frame_threshold': args.frame_threshold,
        'minimum_note_length': args.minimum_note_length,
    }

    if args.minimum_frequency is not None:
        kwargs['minimum_frequency'] = args.minimum_frequency

    if args.maximum_frequency is not None:
        kwargs['maximum_frequency'] = args.maximum_frequency

    if args.no_infer_onsets:
        kwargs['infer_onsets'] = False

    if args.max_polyphony is not None:
        kwargs['max_polyphony'] = args.max_polyphony

    try:
        print("Progress: 30% Converting audio...", file=sys.stdout)
        sys.stdout.flush()

        predict_and_save(
            [args.input],
            args.output_dir,
            **kwargs
        )

        # Determine output path
        basename = os.path.splitext(os.path.basename(args.input))[0]
        output_path = os.path.join(args.output_dir, f"{basename}_basic_pitch.mid")

        print("Progress: 100% Done", file=sys.stdout)
        print(f"OUTPUT: {output_path}", file=sys.stdout)
        sys.stdout.flush()

        sys.exit(0)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
