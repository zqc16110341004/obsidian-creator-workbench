// Three evenly spaced lights, each followed by two fading points, orbit the capsule.
// Negative delays keep the full perimeter animated from the first rendered frame.
const particles = `<span class="hero-particles" aria-hidden="true">${Array.from({length:3},(_,group)=>['head','tail','fade'].map((kind,step)=>`<i class="hero-orbit-${kind}" style="--delay:${-(group*3.2+.8-step*.18)}s"></i>`).join('')).join('')}</span>`;

// Only authored hero markup is passed here. Preserve attributes and click actions.
export function heroActions(markup) {
  return `<div class="hero-actions">${markup.replace(/(<button\b[^>]*>)([\s\S]*?)(<\/button>)/g,(_,open,label,close)=>`${open}<span class="hero-button-label">${label}</span>${particles}${close}`)}</div>`;
}
