[English](./README.md) | [Türkçe](./README.tr.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md) | [中文](./README.zh.md)

> このドキュメントは英語の README から翻訳されたものです。一部不自然な表現がある場合があります。

<h1 align="center">prisme</h1>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  プリズムは白い光を鮮やかな色に分けます。<br/>
  <strong>prisme は複雑なプロジェクトを、初心者からシニア開発者まで誰でも理解できる部分に分けます。</strong>
</p>

---

## クイックスタート

prisme はまだ npm にありません。ソースからインストールし、AI コーディングツールにスキルを登録してください:

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git prisme
cd prisme && npm install && npm link
prisme setup
```

その後は `prisme update` がこのクローンを更新して再ビルドします。

理解したいプロジェクトで、ドキュメントの言語を選びます（任意、デフォルトは英語）:

```bash
prisme config language fr
```

そのプロジェクトで AI コーディングツールを開き、`/prisme-scan` スキルを実行します:

```
/prisme-scan
```

結果を表示し、ビューアが提案するウェルカムガイドに従ってください:

```bash
prisme view
```

## 仕組み

AI がコードベースを読み、**パースペクティブ**を作成します。パースペクティブはプロジェクトを見るさまざまな視点です：何をするのか・誰のためのものか、どう作られているか、データがどう流れるか、どう保護されているか、どう実行・テスト・デプロイするか、そして現在の状態。各パースペクティブは、選んだ言語で Mermaid ダイアグラムとドキュメントフィールドを持ちます。

すべてのエレメントは**再帰的に分析**されます。複雑なものは独自のダイアグラムを持つネストされたエレメントになり、単純なものはリーフのままです。ファイルシステムがツリーを反映します:

```
.prisme/
├── functional-overview/            ← パースペクティブ
├── overall-architecture/
│   ├── description.md
│   ├── diagram.mmd
│   ├── context.md
│   ├── main-process/               ← ネストされたエレメント
│   │   ├── description.md
│   │   ├── diagram.mmd
│   │   └── auth-service/           ← さらに深いネスト
│   │       └── ...
│   └── renderer/
│       └── ...
├── data-flow/
├── operations/
├── project-status/
└── .guides/                        ← ガイド（ステップごとの案内）
```

ビューアはファイルシステムからネストを自動検出します — 子を持つエレメントは展開可能なグループとして、それ以外はノードとしてレンダリングされます。

各エレメントは最大7つのフィールド（`description`、`diagram`、`context`、`constraint`、`concern`、`todo`、`note`）と表示タイトルを持ちます。

### ガイド

**ガイド**はダイアグラムを一歩ずつたどる案内です。ビューアは各エレメントを開き、それ以外を薄く表示し、たどっている矢印を強調します。AIツールで `/prisme-guide` を使って依頼してください（例：`/prisme-guide ユーザーが登録すると何が起きる？`）。`/prisme-scan` はウェルカムガイド `start-here` も作成します。3つのパート（プロジェクトの役割、構成、実行・テスト・デプロイの方法）からなり、ビューアは初回訪問時にそれを提案します。ガイドは `.prisme/.guides/` に保存され、新しいスキャンでガイドが壊れると `prisme validate` が知らせます。

### 質問

ビューアの質問バーに質問を入力してください（例：「認証情報はどこに保存されている？」）：一致するエレメントがダイアグラム上で強調されます。

## CLI

```bash
prisme setup                       # AI ツールにスキルを登録
prisme view                        # インタラクティブビューアを開く
prisme view --no-ai                # Claude Code への質問なしで開く (API: docs/api.md)
prisme config language fr          # ドキュメントとインターフェースの言語を設定
prisme guide list                  # ガイド一覧を表示
prisme changes                     # 前回のスキャン以降の変更
prisme update                      # 最新バージョンに更新
```

全コマンド一覧は `prisme help` を実行してください。

## スキル

スキルは**AI コーディングツール内で**実行するコマンドです（ターミナルではありません）。`/` で始まります。

| スキル | 機能 |
| --- | --- |
| `/prisme-scan` | コードベース分析 → ドキュメントとウェルカムガイドを作成 |
| `/prisme-guide` | 質問に答えるステップごとのガイドを作成 → ビューアで再生 |
| `/prisme-view` | ビューアを開く |

## 対応 AI ツール

| プラットフォーム | セットアップ |
| --- | --- |
| Claude Code | `prisme setup claude` |
| Codex | `prisme setup codex` |
| Cursor | `prisme setup cursor` |
| OpenClaw | `prisme setup openclaw` |
| Antigravity | `prisme setup antigravity` |

`prisme setup` を実行すると、インストール済みのすべてのツールを自動検出して設定します。

## 開発 & コントリビュート

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git
cd oh-my-mermaid-le-retour
npm install && npm run build
npm test
```

Issue と PR を歓迎します。[Conventional Commits](https://www.conventionalcommits.org/) を使用してください。

## クレジット

prisme は MIT ライセンスで公開されている [oh-my-mermaid](https://github.com/oh-my-mermaid/oh-my-mermaid) のフォークから始まりました。

## ライセンス

[MIT](./LICENSE)
