# WCAG 2.1 Level AA — Accessibility Compliance

**Standard:** WCAG 2.1 AA (Web Content Accessibility Guidelines)  
**Last reviewed:** June 2026  
**Relevant legislation:** Equality Act 2010 (UK), EN 301 549 (EU)

## Current Status

EurekaNow is a web-based SaaS application. We aim for WCAG 2.1 Level AA compliance across all user-facing interfaces.

## Implemented Controls

| Criterion | Requirement | Status |
|---|---|---|
| 1.1.1 Non-text Content | Alt text on all images | Review needed |
| 1.3.1 Info and Relationships | Semantic HTML throughout | ✅ React + HTML5 |
| 1.3.3 Sensory Characteristics | No colour-only instructions | ✅ |
| 1.4.1 Use of Colour | Colour not sole differentiator | ✅ |
| 1.4.3 Contrast (Minimum) | 4.5:1 for normal text, 3:1 for large | Review needed |
| 1.4.4 Resize Text | Text scalable to 200% | ✅ |
| 2.1.1 Keyboard | All functionality keyboard accessible | Partial |
| 2.4.1 Bypass Blocks | Skip nav link | Not yet implemented |
| 2.4.2 Page Titled | Descriptive page titles | Review needed |
| 2.4.3 Focus Order | Logical focus order | ✅ |
| 2.4.4 Link Purpose | Descriptive link text | ✅ |
| 2.4.6 Headings and Labels | Descriptive headings | ✅ |
| 2.4.7 Focus Visible | Focus indicator visible | Review needed |
| 3.1.1 Language of Page | `lang` attr on `<html>` | Review needed |
| 3.2.1 On Focus | No unexpected context changes | ✅ |
| 3.3.1 Error Identification | Errors identified and described | ✅ |
| 3.3.2 Labels or Instructions | Form labels present | ✅ |
| 4.1.1 Parsing | Valid HTML | ✅ React |
| 4.1.2 Name, Role, Value | ARIA where needed | Partial |

## Actions Required

- [ ] Audit colour contrast ratios (use Colour Contrast Analyser)
- [ ] Test full keyboard navigation flow
- [ ] Add `lang="en"` to HTML element
- [ ] Add skip-to-main-content link
- [ ] Ensure all form inputs have associated `<label>` elements
- [ ] Audit and add `aria-label` on icon-only buttons
- [ ] Test with screen reader (NVDA / VoiceOver)

## Testing Tools

- axe DevTools browser extension (automated)
- NVDA (Windows) or VoiceOver (macOS) for screen reader testing
- Colour Contrast Analyser (TPGi)
- WebAIM WAVE

## Legal Note

Under the Equality Act 2010, making a SaaS product inaccessible to disabled users can constitute disability discrimination. For B2B products used in the workplace, employers have a duty to make reasonable adjustments — ensuring the tools they purchase are accessible is part of that.
