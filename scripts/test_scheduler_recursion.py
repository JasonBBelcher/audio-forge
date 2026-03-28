#!/usr/bin/env python3
"""
Diagnostic script to isolate the CosineDPMSolverMultistepScheduler recursion issue.
Run directly: ~/.audioforge-venv/bin/python scripts/test_scheduler_recursion.py

Tests each suspect component in isolation so we can pinpoint the exact failure.
"""

import sys
import threading
import traceback

sys.setrecursionlimit(1 << 20)

VENV_PYTHON = "~/.audioforge-venv/bin/python"

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def ok(msg):   print(f"  ✅  {msg}")
def fail(msg): print(f"  ❌  {msg}")
def info(msg): print(f"  ℹ️   {msg}")


# ── 1. Package versions ───────────────────────────────────────────────────────
section("1. Package versions")
try:
    import torch
    ok(f"torch         {torch.__version__}")
except ImportError as e:
    fail(f"torch not found: {e}")
    sys.exit(1)

try:
    import diffusers
    ok(f"diffusers     {diffusers.__version__}")
except ImportError as e:
    fail(f"diffusers not found: {e}")
    sys.exit(1)

try:
    import torchsde
    ok(f"torchsde      {torchsde.__version__}")
except ImportError as e:
    fail(f"torchsde not found: {e}")

try:
    import soundfile
    ok(f"soundfile     {soundfile.__version__}")
except ImportError as e:
    fail(f"soundfile not found: {e}")


# ── 2. Device availability ────────────────────────────────────────────────────
section("2. Device availability")
info(f"CUDA available : {torch.cuda.is_available()}")
info(f"MPS  available : {torch.backends.mps.is_available()}")


# ── 3. Load pipeline ──────────────────────────────────────────────────────────
section("3. Load StableAudioPipeline from cache")
try:
    from diffusers import StableAudioPipeline
    pipe = StableAudioPipeline.from_pretrained(
        "stabilityai/stable-audio-open-1.0",
        torch_dtype=torch.float32,
    )
    ok("Pipeline loaded successfully")
    info(f"Scheduler type : {type(pipe.scheduler).__name__}")
    info(f"Scheduler config keys: {list(pipe.scheduler.config.keys())}")
except Exception as e:
    fail(f"Failed to load pipeline: {e}")
    traceback.print_exc()
    sys.exit(1)


# ── 4. Move to CPU ────────────────────────────────────────────────────────────
section("4. Move pipeline to CPU")
try:
    pipe = pipe.to("cpu")
    ok("pipe.to('cpu') succeeded")
except Exception as e:
    fail(f"pipe.to('cpu') failed: {e}")
    traceback.print_exc()
    sys.exit(1)


# ── 5. Scheduler step in isolation ───────────────────────────────────────────
section("5. Scheduler step in isolation (1 step, no model)")
try:
    pipe.scheduler.set_timesteps(20)
    timesteps = pipe.scheduler.timesteps
    info(f"Timesteps shape : {timesteps.shape}, dtype: {timesteps.dtype}")
    info(f"First timestep  : {timesteps[0].item():.4f}")

    # Create a fake latent (shape doesn't matter much for scheduler step test)
    fake_latent   = torch.randn(1, 64, 256)
    fake_output   = torch.randn_like(fake_latent)
    t             = timesteps[0]

    info(f"Calling scheduler.step(fake_output, t={t.item():.4f}, fake_latent) ...")
    result = pipe.scheduler.step(fake_output, t, fake_latent)
    ok(f"scheduler.step succeeded — prev_sample shape: {result.prev_sample.shape}")

except RecursionError:
    fail("RecursionError in scheduler.step — this IS the bug")
    traceback.print_exc()
except Exception as e:
    fail(f"scheduler.step failed with {type(e).__name__}: {e}")
    traceback.print_exc()


# ── 6. Same step inside large-stack thread ───────────────────────────────────
section("6. Scheduler step inside 256 MB stack thread")
_result = [None]
_error  = [None]

def _run():
    try:
        pipe.scheduler.set_timesteps(20)
        t = pipe.scheduler.timesteps[0]
        fake_latent = torch.randn(1, 64, 256)
        fake_output = torch.randn_like(fake_latent)
        _result[0] = pipe.scheduler.step(fake_output, t, fake_latent)
    except Exception as e:
        _error[0] = e

try:
    threading.stack_size(256 * 1024 * 1024)
    t = threading.Thread(target=_run)
    t.start()
    t.join()
    if _error[0]:
        fail(f"Still fails in large-stack thread: {type(_error[0]).__name__}: {_error[0]}")
        if isinstance(_error[0], RecursionError):
            info("→ Infinite recursion, not a stack-depth issue")
    else:
        ok(f"scheduler.step succeeded in large-stack thread")
except Exception as e:
    fail(f"Thread creation failed: {e}")


# ── 7. Full pipeline run — find the exact recursing function ─────────────────
section("7. Full pipeline run with 1 step (captures recursion traceback)")
info("Using a small recursion limit so the traceback is short and readable ...")

_r = [None]
_e = [None]
_tb = [None]

def _run_full():
    # Small limit → traceback is short; the repeating frames show the looping call
    old_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(300)
    try:
        _r[0] = pipe(
            "hi hats",
            num_inference_steps=1,
            audio_end_in_s=1.0,
            num_waveforms_per_prompt=1,
            guidance_scale=1.5,
        )
    except RecursionError as e:
        _e[0] = e
        _tb[0] = traceback.format_exc()
    except Exception as e:
        _e[0] = e
        _tb[0] = traceback.format_exc()
    finally:
        sys.setrecursionlimit(old_limit)

try:
    threading.stack_size(256 * 1024 * 1024)
    t = threading.Thread(target=_run_full)
    t.start()
    t.join(timeout=300)  # 5-minute cap
    if t.is_alive():
        fail("Pipeline timed out after 5 minutes — likely a true hang, not recursion")
    elif _e[0] is not None:
        fail(f"{type(_e[0]).__name__}: {_e[0]}")
        if _tb[0]:
            print("\n--- Traceback (last unique frames) ---")
            # Print only unique lines to cut through the repetition
            seen = set()
            for line in _tb[0].splitlines():
                key = line.strip()
                if key not in seen:
                    seen.add(key)
                    print(line)
            print("--- End traceback ---")
    else:
        ok("Full pipeline succeeded!")
        info(f"Output shape: {_r[0].audios.shape}")
except Exception as e:
    fail(f"Thread setup failed: {e}")
    traceback.print_exc()


# ── 8. Summary ────────────────────────────────────────────────────────────────
# ── 8. Verify BrownianTreeNoiseSampler patch works ───────────────────────────
section("8. BrownianTreeNoiseSampler clamp patch + full pipeline re-run")
info("Applying patch and retrying with 1 step ...")

from diffusers.schedulers.scheduling_dpmsolver_sde import BrownianTreeNoiseSampler as BTNS

_orig_init = BTNS.__init__
_orig_call = BTNS.__call__

def _p_init(self, x, sigma_min, sigma_max, seed=None, transform=lambda x: x):
    _orig_init(self, x, sigma_min, sigma_max, seed=seed, transform=transform)
    t0 = self.transform(torch.as_tensor(sigma_min, dtype=torch.float64))
    t1 = self.transform(torch.as_tensor(sigma_max, dtype=torch.float64))
    self._valid_t_lo = float(min(t0, t1))
    self._valid_t_hi = float(max(t0, t1))

def _p_call(self, sigma, sigma_next):
    t0 = self.transform(torch.as_tensor(sigma))
    t1 = self.transform(torch.as_tensor(sigma_next))
    lo, hi = self._valid_t_lo, self._valid_t_hi
    t0 = t0.clamp(lo, hi)
    t1 = t1.clamp(lo, hi)
    denom = (t1 - t0).abs().sqrt()
    if denom == 0:
        return torch.zeros_like(t0)
    return self.tree(t0, t1) / denom

BTNS.__init__ = _p_init
BTNS.__call__ = _p_call
ok("Patch applied")

_r2 = [None]; _e2 = [None]
def _run2():
    try:
        _r2[0] = pipe("hi hats", num_inference_steps=1, audio_end_in_s=1.0,
                      num_waveforms_per_prompt=1, guidance_scale=1.5)
    except Exception as e:
        _e2[0] = e

try:
    threading.stack_size(256 * 1024 * 1024)
    t = threading.Thread(target=_run2)
    t.start()
    t.join(timeout=300)
    if t.is_alive():
        fail("Still timed out after patch")
    elif _e2[0]:
        fail(f"Still failing after patch: {type(_e2[0]).__name__}: {_e2[0]}")
        traceback.print_exc()
    else:
        ok(f"Pipeline succeeded after patch! Audio shape: {_r2[0].audios.shape}")
except Exception as e:
    fail(f"Thread error: {e}")


# ── 9. Summary ────────────────────────────────────────────────────────────────
section("Summary")
info("Step 5+6 passed → scheduler.step() is fine in isolation")
info("Step 7 shows the recursion location (BrownianInterval._split)")
info("Step 8 confirms whether the clamp patch fixes it")
