import { useState } from 'react';
import ArchitectureLoading from '../ArchitectureLoading/index.jsx';
import { useHydrated } from '../../../hooks/useHydrated.js';

export default function ArchitectureViewer({ document, title }) {
  const [loaded, setLoaded] = useState(false);
  const hydrated = useHydrated();
  return (
    <section
      className="architecture-viewer"
      aria-label={title}
      aria-busy={!loaded}
      data-loading={!loaded}
    >
      {!loaded && <ArchitectureLoading />}
      {hydrated ? (
        <iframe
          src={`${document}?theme=light&present=1`}
          title={title}
          sandbox="allow-scripts allow-downloads"
          referrerPolicy="same-origin"
          onLoad={() => setLoaded(true)}
          aria-hidden={!loaded}
          tabIndex={loaded ? 0 : -1}
        />
      ) : (
        <div className="architecture-frame-placeholder" aria-hidden="true" />
      )}
    </section>
  );
}
