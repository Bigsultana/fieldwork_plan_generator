# Fieldwork Plan Generator — Implementation Notes

The product is a browser-first FastAPI application. Preserve separation between HTTP/upload handling and the PowerPoint builder.

The current baseline intentionally has no database, authentication or permanent uploaded-file storage. Treat those as explicit future product decisions rather than adding them incidentally.
