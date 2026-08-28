function FullScreenLoader() {
  return (
    <main className="grid min-h-svh place-items-center" role="status">
      <div aria-label="Loading" className="loading-three-dots" role="img">
        <span />
        <span />
        <span />
      </div>
      <span className="sr-only">Loading</span>
    </main>
  );
}

export default FullScreenLoader;
