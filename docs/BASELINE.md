# Browser Baseline

The production application is a static browser bundle. Cloudflare serves the generated assets, while all selected images and generated PowerPoint data remain in the browser process.

## Supported workflow

1. Enter project and title-block information.
2. Select up to 60 images.
3. Edit or import sheet metadata.
4. Optionally select a company logo.
5. Generate and download an A1 PowerPoint.

## Deliberate constraints

- No server-side file storage.
- No arbitrary PowerPoint-template modification.
- No user accounts or application database.
- Browser memory sets the practical project-size limit.
