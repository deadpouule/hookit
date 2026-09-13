type BranchBox = {
  t: string;
  d: string;
};

export function DocsBranchGraph({
  caption,
  kicker,
  sources,
  hub,
  outputs,
  note,
}: {
  caption: string;
  kicker?: string;
  sources: BranchBox[];
  hub: BranchBox;
  outputs: BranchBox[];
  note?: string;
}) {
  return (
    <figure className="docs-schema">
      <figcaption>{caption}</figcaption>
      <div className="docs-branch" role="img" aria-label={caption}>
        {kicker ? <p className="docs-branch-kicker">{kicker}</p> : null}
        <div className="docs-branch-grid">
          <div className="docs-branch-col">
            {sources.map((box) => (
              <article key={box.t} className="docs-branch-box">
                <strong>{box.t}</strong>
                <span>{box.d}</span>
              </article>
            ))}
          </div>
          <div className="docs-branch-join" aria-hidden>
            <i />
            <b />
            <i />
          </div>
          <article className="docs-branch-box docs-branch-box--hub">
            <strong>{hub.t}</strong>
            <span>{hub.d}</span>
          </article>
          <div className="docs-branch-join docs-branch-join--out" aria-hidden>
            <i />
            <b />
            <i />
          </div>
          <div className="docs-branch-col">
            {outputs.map((box) => (
              <article key={box.t} className="docs-branch-box">
                <strong>{box.t}</strong>
                <span>{box.d}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
      {note ? <p className="docs-schema-note">{note}</p> : null}
    </figure>
  );
}
