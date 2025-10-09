# GitHub Actions Usage Guide

<h4 align="right"><strong>English</strong> | <a href="github-actions-usage_CN.md">简体中文</a></h4>

Build Pake apps online without installing development tools locally.

## Quick Steps

### 1. Fork Repository

[Fork this project](https://github.com/tw93/Pake/fork)

### 2. Run Workflow

1. Go to Actions tab in your forked repository
2. Select `Build App With Pake CLI`
3. Fill in the form (same parameters as [CLI options](cli-usage.md))
4. Click `Run Workflow`

   ![Actions Interface](https://raw.githubusercontent.com/tw93/static/main/pake/action.png)

### 3. Download App

- Green checkmark = build success
- Click the workflow name to view details
- Find `Artifacts` section and download your app

  ![Build Success](https://raw.githubusercontent.com/tw93/static/main/pake/action2.png)

### 4. Build Times

- **First run**: ~10-15 minutes (sets up cache)
- **Subsequent runs**: ~5 minutes (uses cache)
- Cache size: 400-600MB when complete

## Tips

- Be patient on first run - let cache build completely
- Stable network connection recommended
- If build fails, delete cache and retry

## Links

- [CLI Documentation](cli-usage.md)
- [Advanced Usage](advanced-usage.md)
