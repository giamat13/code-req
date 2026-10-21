# Security Policy

## Supported versions

Only the latest released minor version receives security fixes. While the
project is below `1.0.0`, that means the most recent `0.x` release.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report privately through
[GitHub Security Advisories](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository (**Security → Report a vulnerability**).

Include:

- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept. Rules tests are the best format
  for Firestore issues.
- The commit or release you tested.

## What to expect

- Acknowledgement within 5 business days.
- An initial assessment within 10 business days.
- A fix or a documented mitigation, coordinated with you before disclosure.

## In scope

- Firestore security rules that allow access the documentation forbids.
- Cross-site scripting, including through SVG icons or message bodies.
- Authentication or authorization bypass, including suspended-account bypass.
- Data exposure through the tracking links, the directory, or exports.

## Out of scope

- Denial-of-service against Firebase or GitHub infrastructure.
- Spam that does not bypass the documented controls.
- Social engineering and physical attacks.
- Findings that require a compromised developer device.

## Safe harbor

Good-faith research that follows this policy will not lead to legal action from
the maintainers.
