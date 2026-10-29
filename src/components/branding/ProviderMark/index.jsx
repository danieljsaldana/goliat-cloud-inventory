import './ProviderMark.css';

export default function ProviderMark({ large = false }) {
  return (
    <span className={`provider-mark azure ${large ? 'large' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <path fill="currentColor" d="M16 5 3 28h9L25 5zM27 12 17 29l11 2H12l-3 5h28z" />
      </svg>
    </span>
  );
}
