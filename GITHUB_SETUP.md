# GitHub Setup for Auto-Builds

## Quick Steps to Get macOS Builds

1. **Initialize Git Repository** (if not already done)
```bash
cd E:\gpmscraper
git init
git add .
git commit -m "Initial commit"
```

2. **Create GitHub Repository**
- Go to https://github.com/new
- Repository name: `gpmscraper` (or your preferred name)
- Set to Private
- Don't initialize with README (we already have one)

3. **Push to GitHub**
```bash
git remote add origin https://github.com/YOUR_USERNAME/gpmscraper.git
git branch -M main
git push -u origin main
```

4. **Enable GitHub Actions**
- Go to your repository on GitHub
- Click "Actions" tab
- If prompted, click "I understand my workflows, go ahead and enable them"

5. **Wait for Build**
- Go to Actions tab → "Build Cross-Platform Apps" workflow
- It will run on both Windows and macOS runners
- Download artifacts when complete:
  - `scraper-windows` → Windows .exe
  - `scraper-macos` → macOS .dmg
  - `keygen-windows` → Keygen .exe
  - `keygen-macos` → Keygen .dmg

## Create a Release (Optional)

To create a proper release with downloads:

1. **Create a tag**
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. **Release will be created automatically**
- GitHub Actions will detect the tag
- Create a new Release with all build artifacts
- Users can download from the Releases page

## Notes

- First build might take 5-10 minutes
- macOS builds run on GitHub's hosted Mac runners
- All builds include both Intel (x64) and Apple Silicon (arm64) for macOS
- No code signing - users may need to right-click → Open on macOS first run
