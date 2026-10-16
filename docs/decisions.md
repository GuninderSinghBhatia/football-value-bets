# Decisions

Why we chose X over Y. One entry per decision, newest first. Keep it short: an interviewer should be able to read any
entry in 30 seconds.

## Template

### YYYY-MM-DD: Decision title
- **Decision:** what we chose.
- **Alternatives:** what else we considered.
- **Why:** the reason, with numbers where possible.
- **Revisit if:** what would change our mind.

---

### 2026-10-16: Python 3.12 + uv for the ML environment
- **Decision:** Python 3.12, managed by uv, with dependencies locked in `uv.lock`.
- **Alternatives:** the system Python 3.14 with pip + venv; conda.
- **Why:** ML libraries (LightGBM, SHAP, MLflow) are most reliable on 3.12, and uv gives a reproducible environment from
  one command (`uv sync`).
- **Revisit if:** a library we need drops 3.12 support.
