import "./logo-loop.css";

function LogoLoop({ logos }) {
  const repeatedLogos = [...logos, ...logos];

  return (
    <div className="logo-loop" role="region" aria-label="Trusted brands">
      <div className="logo-loop__track">
        {repeatedLogos.map((logo, index) => (
          <div
            aria-hidden={index >= logos.length ? "true" : undefined}
            className="logo-loop__item"
            key={`${logo.src}-${index}`}
          >
            <img alt={index < logos.length ? logo.alt : ""} src={logo.src} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LogoLoop;
