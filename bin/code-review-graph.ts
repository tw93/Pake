#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Contributor {
  name: string;
  email: string;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  reviewsGiven: number;
  reviewsReceived: number;
  firstCommit: string;
  lastCommit: string;
  filesChanged: Set<string>;
}

interface PREvent {
  number: number;
  title: string;
  author: { login: string };
  state: string;
  createdAt: string;
  mergedAt?: string;
  mergedBy?: { login: string };
}

interface ReviewGraph {
  contributors: Map<string, Contributor>;
  prs: PREvent[];
  reviewRelations: Map<string, Map<string, number>>;
  timeRange: { start: string; end: string };
}

class CodeReviewGraph {
  private graph: ReviewGraph;

  constructor() {
    this.graph = {
      contributors: new Map(),
      prs: [],
      reviewRelations: new Map(),
      timeRange: { start: '', end: '' },
    };
  }

  async build(): Promise<void> {
    console.log('Analyzing repository data...\n');

    await this.analyzeCommits();
    await this.analyzePRs();
    this.analyzeReviewRelations();

    return;
  }

  private async analyzeCommits(): Promise<void> {
    try {
      // Commands are hardcoded internal commands, not user input
      const logOutput = execSync(
        'git log --format="%H|%an|%ae|%ad|%s" --date=short -500',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
      );

      const lines = logOutput.trim().split('\n');

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length < 5) continue;

        const [, name, email, date] = parts;

        if (!this.graph.contributors.has(email)) {
          this.graph.contributors.set(email, {
            name,
            email,
            commits: 0,
            prsOpened: 0,
            prsMerged: 0,
            reviewsGiven: 0,
            reviewsReceived: 0,
            firstCommit: date,
            lastCommit: date,
            filesChanged: new Set(),
          });
        }

        const contributor = this.graph.contributors.get(email)!;
        contributor.commits++;
        contributor.lastCommit = date;

        if (!this.graph.timeRange.start || date < this.graph.timeRange.start) {
          this.graph.timeRange.start = date;
        }
        if (!this.graph.timeRange.end || date > this.graph.timeRange.end) {
          this.graph.timeRange.end = date;
        }
      }
    } catch (error) {
      console.warn('Could not analyze commits:', (error as Error).message);
    }
  }

  private async analyzePRs(): Promise<void> {
    try {
      const prOutput = execSync(
        'gh pr list --state all --limit 100 --json number,title,author,state,mergedAt,createdAt,mergedBy 2>/dev/null || echo "[]"',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
      );

      const prs = JSON.parse(prOutput.trim() || '[]') as PREvent[];
      this.graph.prs = prs;

      for (const pr of prs) {
        const authorEmail = this.findEmailByUsername(pr.author.login);

        if (authorEmail && this.graph.contributors.has(authorEmail)) {
          const contributor = this.graph.contributors.get(authorEmail)!;
          contributor.prsOpened++;
          if (pr.state === 'MERGED') {
            contributor.prsMerged++;
          }
        }

        if (pr.mergedBy?.login) {
          const mergerEmail = this.findEmailByUsername(pr.mergedBy.login);
          if (mergerEmail && this.graph.contributors.has(mergerEmail)) {
            const merger = this.graph.contributors.get(mergerEmail)!;
            merger.reviewsGiven++;
          }
        }
      }
    } catch (error) {
      console.warn('Could not analyze PRs:', (error as Error).message);
    }
  }

  private findEmailByUsername(username: string): string | null {
    const usernameLower = username.toLowerCase();
    for (const [email, contributor] of this.graph.contributors) {
      if (
        contributor.name.toLowerCase().includes(usernameLower) ||
        email.toLowerCase().includes(usernameLower)
      ) {
        return email;
      }
    }
    return null;
  }

  private analyzeReviewRelations(): void {
    for (const pr of this.graph.prs) {
      if (pr.mergedBy?.login && pr.author.login !== pr.mergedBy.login) {
        const authorKey = pr.author.login;
        const mergerKey = pr.mergedBy.login;

        if (!this.graph.reviewRelations.has(mergerKey)) {
          this.graph.reviewRelations.set(mergerKey, new Map());
        }

        const relations = this.graph.reviewRelations.get(mergerKey)!;
        relations.set(authorKey, (relations.get(authorKey) || 0) + 1);
      }
    }
  }

  generateMermaidGraph(): string {
    const lines: string[] = [
      '%% Code Review Graph for Pake',
      '%% Generated automatically - do not edit manually',
      '',
      'flowchart TB',
      '    subgraph Contributors["Top Contributors"]',
    ];

    const sortedContributors = Array.from(this.graph.contributors.values())
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 15);

    const nodeMap = new Map<string, string>();
    let idx = 0;

    for (const c of sortedContributors) {
      const nodeId = `C${idx}`;
      nodeMap.set(c.email, nodeId);

      const prBadge = c.prsMerged > 0 ? ` PRs:${c.prsMerged}` : '';
      const label = `${c.name}(${c.commits})${prBadge}`;

      lines.push(`        ${nodeId}["${label}"]`);
      idx++;
    }

    lines.push('    end');
    lines.push('');

    const addedEdges = new Set<string>();
    for (const [reviewer, relations] of this.graph.reviewRelations) {
      // reviewer is already a string (the login), not an object
      const reviewerEmail = this.findEmailByUsername(reviewer);
      if (!reviewerEmail || !nodeMap.has(reviewerEmail)) continue;

      const reviewerNode = nodeMap.get(reviewerEmail)!;

      for (const [author, count] of relations) {
        // author is already a string (the login)
        const authorEmail = this.findEmailByUsername(author);
        if (!authorEmail || !nodeMap.has(authorEmail)) continue;

        const authorNode = nodeMap.get(authorEmail)!;
        const edgeKey = `${reviewerNode}-${authorNode}`;

        if (!addedEdges.has(edgeKey)) {
          lines.push(`    ${reviewerNode} -.->|"reviews"| ${authorNode}`);
          addedEdges.add(edgeKey);
        }
      }
    }

    lines.push('');
    lines.push('    subgraph Recent_Merges["Recent Merged PRs"]');

    const mergedPRs = this.graph.prs
      .filter((pr) => pr.state === 'MERGED')
      .slice(0, 8);

    for (let i = 0; i < mergedPRs.length; i++) {
      const pr = mergedPRs[i];
      const prNode = `PR${i}`;
      const title =
        pr.title.length > 30 ? pr.title.substring(0, 30) + '...' : pr.title;
      lines.push(`        ${prNode}["#${pr.number}: ${title}"]`);
    }

    lines.push('    end');
    lines.push('');

    lines.push('    subgraph Stats["Statistics"]');
    lines.push(
      `        TotalContributors["Total Contributors: ${this.graph.contributors.size}"]`,
    );
    lines.push(
      `        TotalPRs["Total PRs Analyzed: ${this.graph.prs.length}"]`,
    );
    lines.push(
      `        MergedPRs["Merged PRs: ${this.graph.prs.filter((p) => p.state === 'MERGED').length}"]`,
    );
    lines.push(
      `        TimeRange["Period: ${this.graph.timeRange.start} to ${this.graph.timeRange.end}"]`,
    );
    lines.push('    end');

    lines.push('');
    lines.push('    %% Styling');
    lines.push(
      '    classDef contributor fill:#e1f5fe,stroke:#01579b,stroke-width:2px',
    );
    lines.push(
      '    classDef reviewer fill:#fff3e0,stroke:#e65100,stroke-width:2px',
    );
    lines.push('    classDef pr fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px');
    lines.push(
      '    classDef stats fill:#f3e5f5,stroke:#6a1b9a,stroke-width:1px',
    );

    for (let i = 0; i < idx; i++) {
      lines.push(`    class C${i} contributor`);
    }
    for (let i = 0; i < mergedPRs.length; i++) {
      lines.push(`    class PR${i} pr`);
    }
    lines.push(
      '    class TotalContributors,TotalPRs,MergedPRs,TimeRange stats',
    );

    return lines.join('\n');
  }

  generateJSON(): object {
    const contributors = Array.from(this.graph.contributors.values())
      .map((c) => ({
        ...c,
        filesChanged: Array.from(c.filesChanged),
      }))
      .sort((a, b) => b.commits - a.commits);

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        repository: 'tw93/Pake',
        timeRange: this.graph.timeRange,
      },
      summary: {
        totalContributors: this.graph.contributors.size,
        totalPRs: this.graph.prs.length,
        mergedPRs: this.graph.prs.filter((p) => p.state === 'MERGED').length,
        closedPRs: this.graph.prs.filter((p) => p.state === 'CLOSED').length,
        openPRs: this.graph.prs.filter((p) => p.state === 'OPEN').length,
      },
      contributors: contributors.slice(0, 20),
      recentPRs: this.graph.prs.slice(0, 20),
      reviewRelations: Object.fromEntries(
        Array.from(this.graph.reviewRelations.entries()).map(([k, v]) => [
          k,
          Object.fromEntries(v),
        ]),
      ),
    };
  }

  printSummary(): void {
    console.log(
      '\n===============================================================',
    );
    console.log(
      '                    Code Review Graph Summary                  ',
    );
    console.log(
      '===============================================================\n',
    );

    console.log(
      `Time Range: ${this.graph.timeRange.start} to ${this.graph.timeRange.end}`,
    );
    console.log(`Total Contributors: ${this.graph.contributors.size}`);
    console.log(`Total PRs Analyzed: ${this.graph.prs.length}`);
    console.log(
      `  Merged: ${this.graph.prs.filter((p) => p.state === 'MERGED').length}`,
    );
    console.log(
      `  Closed: ${this.graph.prs.filter((p) => p.state === 'CLOSED').length}`,
    );
    console.log(
      `  Open: ${this.graph.prs.filter((p) => p.state === 'OPEN').length}\n`,
    );

    console.log('Top Contributors by Commits:');
    const sorted = Array.from(this.graph.contributors.values())
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10);

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const rank = i === 0 ? '1.' : i === 1 ? '2.' : i === 2 ? '3.' : '  ';
      const prInfo = c.prsMerged > 0 ? ` (PRs merged: ${c.prsMerged})` : '';
      console.log(`   ${rank} ${c.name}: ${c.commits} commits${prInfo}`);
    }

    if (this.graph.reviewRelations.size > 0) {
      console.log('\nReview Relationships (Merger -> Author):');
      for (const [reviewer, relations] of this.graph.reviewRelations) {
        const relationsStr = Array.from(relations.entries())
          .map(([author, count]) => `${author}(${count})`)
          .join(', ');
        console.log(`   ${reviewer} -> ${relationsStr}`);
      }
    }

    console.log('\n');
  }
}

const program = new Command();

program
  .name('code-review-graph')
  .description('Generate code review graph for Pake project')
  .version('1.0.0')
  .option('-o, --output <path>', 'Output file path', 'code-review-graph.mmd')
  .option('-f, --format <format>', 'Output format (mermaid|json)', 'mermaid')
  .option('-s, --stdout', 'Print to stdout instead of file', false)
  .action(async (options) => {
    const graph = new CodeReviewGraph();
    await graph.build();

    graph.printSummary();

    let output: string;
    if (options.format === 'json') {
      output = JSON.stringify(graph.generateJSON(), null, 2);
    } else {
      output = graph.generateMermaidGraph();
    }

    if (options.stdout) {
      console.log(output);
    } else {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, output, 'utf-8');
      console.log(`Graph saved to: ${outputPath}`);

      if (options.format === 'mermaid') {
        console.log('\nTo view this graph:');
        console.log('   1. Use GitHub markdown (paste into .md file)');
        console.log('   2. Use VS Code with Mermaid extension');
        console.log('   3. Visit https://mermaid.live/ and paste the content');
      }
    }
  });

program.parse();
