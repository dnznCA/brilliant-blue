// A single species row: thumbnail + name block.
// Reused in BOTH the search dropdown and the sidebar so the
// image-state logic lives in exactly one place.
//
// Props:
//   image        - photo URL, or null
//   imageStatus  - "loading" | "done"
//   commonName   - common name, or null
//   scientificName
//   size         - "small" (dropdown) | "large" (sidebar)
export default function SpeciesCard({
  image,
  imageStatus,
  commonName,
  scientificName,
  size = "large",
}) {
  const dim = size === "small" ? 40 : 56;
  const radius = size === "small" ? 6 : 10;
  const nameSize = size === "small" ? 14 : 15;
  const sciSize = size === "small" ? 12 : 13;
  const safeImage = image && /^https:\/\//i.test(image) ? image : null;

  const placeholder = {
    width: dim,
    height: dim,
    borderRadius: radius,
    flexShrink: 0,
    background: "#f0f0f0",
    color: "#999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size === "small" ? 7 : 9,
    textAlign: "center",
    padding: 3,
    lineHeight: 1.1,
  };

  return (
    <>
      {/* THUMBNAIL — three states */}
      {imageStatus === "loading" ? (
        <div style={placeholder}>Loading image...</div>
      ) : image ? (
        <img
          src={image}
          alt={scientificName}
          style={{ width: dim, height: dim, objectFit: "cover", borderRadius: radius, flexShrink: 0 }}
        />
      ) : (
        <div style={placeholder}>No image available</div>
      )}

      {/* NAME BLOCK — common name primary, scientific secondary */}
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 600,
            color: "#202124",
            whiteSpace: size === "small" ? "nowrap" : "normal",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {commonName || scientificName}
        </div>
        {commonName && (
          <div style={{ fontSize: sciSize, fontStyle: "italic", color: "#70757a" }}>
            {scientificName}
          </div>
        )}
      </div>
    </>
  );
}