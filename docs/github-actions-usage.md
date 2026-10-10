# GitHub Actions Usage Guide

<div align="center">

**English** · [中文](github-actions-usage_CN.md)

</div>

Build Pake apps online without installing development tools locally.

## Quick Steps

1. [Fork this project](https://github.com/tw93/Pake/fork)
2. In your fork, open the Actions tab, select `Build App With Pake CLI`, fill in the form (same parameters as [CLI options](cli-usage.md)), and click `Run Workflow`

   ![Actions Interface](https://raw.githubusercontent.com/tw93/static/main/pake/action.png)

3. A green checkmark means the build succeeded, click the workflow name and download your app from the `Artifacts` section

   ![Build Success](https://raw.githubusercontent.com/tw93/static/main/pake/action2.png)

The first run builds the dependency cache and takes about 10-15 minutes, later runs use the cache and take about 5 minutes, and the complete cache is 400-600MB.

## Tips

- Enable `Allow sites to open new windows` when the site launches sign-in, exam, or other flows in a separate window
- If a build fails, clear the Actions cache and retry

## Related Docs

- [CLI Usage Guide](cli-usage.md)
- [Advanced Usage](advanced-usage.md)
