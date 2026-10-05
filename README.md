# Kiro University Challenge Project 🎓

This repository contains my final project submission for the **Kiro University Challenge (September 21 - October 5, 2026)**

Built a spec-driven development environment using Kiro's orchestration framework, featuring a strict-mode steering configuration, a custom Code Reviewer agent, a pre-commit lifecycle hook, property-based tests, MCP integration, and a packaged Kiro power. The project demonstrates how Kiro's `.kiro/` architecture enables structured, automated, and verifiable development workflows.

---

## 📁 Repository Structure

```text
.kiro/
├── steering/
│   └── main.toml                    # Engine configuration & strict-mode parameters
├── agents/
│   └── reviewer.json                # Custom Code Reviewer agent
├── hooks/
│   └── pre-commit.sh                # Workflow validation hook script
├── powers/
│   └── reviewer-power/
│       └── plugin.json              # Packaged Kiro power
└── settings/
    └── mcp.json                     # Model Context Protocol configuration
tests/
└── property_test.py                 # Property-based tests (Hypothesis)
```

---

## 🛠️ Components

### 1. Spec-Driven Development
The entire project is structured around Kiro's spec-driven development methodology, using the `.kiro/` directory to define agents, hooks, steering, and powers.

### 2. Steering Configuration (`.kiro/steering/main.toml`)
Strict-mode engine configuration using the `kiro-large-latest` model with a low temperature for deterministic output.
* Mode: `strict`
* Temperature: `0.2`

### 3. Custom Agent (`.kiro/agents/reviewer.json`)
A custom **Code Reviewer** agent that parses files and provides concise feedback using the `file_reader` toolset.

### 4. Hooks (`.kiro/hooks/pre-commit.sh`)
A pre-commit lifecycle hook that validates workspace integrity before commits are finalized.

### 5. Property-Based Testing (`tests/property_test.py`)
Uses the [Hypothesis](https://hypothesis.readthedocs.io/) library to validate correctness properties:
- Hook paths are non-empty strings
- Steering temperature is always between 0.0 and 1.0
- Agent tools list is never empty
- Project version follows semver format

### 6. Model Context Protocol (`.kiro/settings/mcp.json`)
MCP server configuration integrating the AWS Documentation MCP server for enhanced context during development.

### 7. Powers (`.kiro/powers/reviewer-power/plugin.json`)
A packaged Kiro power that bundles the Code Reviewer agent for reuse and distribution.

---

## 🚀 Local Setup & Validation

```bash
# 1. Clone this repository
git clone https://github.com/knivesthao/kiro-university-sprint

# 2. Navigate to the project directory
cd kiro-university-sprint

# 3. Make the hook executable and run it
chmod +x .kiro/hooks/pre-commit.sh
./.kiro/hooks/pre-commit.sh

# 4. Install test dependencies and run property-based tests
python3 -m ensurepip --upgrade
python3 -m pip install hypothesis pytest
python3 -m pytest tests/property_test.py -v
```

---

## 🎯 Challenge Requirements Checklist
- [x] GitHub account age > 3 months
- [x] Initial commit timestamped after September 21, 2026
- [x] Spec-driven development structure
- [x] Steering document configured
- [x] Pre-commit hook implemented
- [x] Property-based tests written
- [x] Model Context Protocol (MCP) configured
- [x] Custom agent configured
- [x] Kiro power packaged
- [x] Public project demo recorded
- [x] Social proof shared on LinkedIn/X
