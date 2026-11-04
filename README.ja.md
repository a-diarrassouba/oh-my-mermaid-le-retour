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

ビューアの質問バーに自由に質問を入力してください（例：「`prisme write` を実行すると何が起きる？」「セッションはどこで確認される？」）。Claude Code がダイアグラム上で答えます：矢印に沿って経路をたどり、見るべきブロックを強調し、またはファイルを該当行で開き、各ステップに説明を付けます。その間、質問の単語に一致するエレメントが強調されます。回答は左パネルの「あなたの質問」に保存されます。

これには `prisme view` を実行するマシンに Claude Code がインストールされ、ログインしている必要があります（`claude` を実行して `/login`）。ビューアを開くだけの人は何も必要ありません。Claude はプロジェクトを読むだけで（`.env` ファイルや鍵は読まない）、変更は一切しません。`prisme view --no-ai` で質問機能をオフにできます。

ホーム画面のセキュリティタイルをクリックするとスコアを計算します：既知のリスク（秘密情報、危険なコード、OpenSSF Scorecard 流の CI・依存関係の管理）を自動で点検し、各項目に OWASP Top 10 の分類が付きます。インストールは不要です。続いて `/prisme-security` で Claude が各項目を確認します。

## CLI

```bash
prisme setup                       # AI ツールにスキルを登録
prisme view                        # インタラクティブビューアを開く
prisme view --no-ai                # Claude Code への質問なしで開く (API: docs/api.md)
prisme config language fr          # ドキュメントとインターフェースの言語を設定
prisme guide list                  # ガイド一覧を表示
prisme changes                     # 前回のスキャン以降の変更
prisme security                    # 自動点検のセキュリティスコア A–E（gitleaks、osv-scanner、semgrep があれば使用）
prisme evolve show                 # /prisme-evolve が書いたプロジェクト改善のアイデア
prisme update                      # 最新バージョンに更新
```

全コマンド一覧は `prisme help` を実行してください。

## スキル

スキルは**AI コーディングツール内で**実行するコマンドです（ターミナルではありません）。`/` で始まります。

| スキル | 機能 |
| --- | --- |
| `/prisme-scan` | コードベース分析 → ドキュメントとウェルカムガイドを作成 |
| `/prisme-guide` | 質問に答えるステップごとのガイドを作成 → ビューアで再生 |
| `/prisme-security` | `prisme security` を実行し、評価をやさしい言葉で説明、各項目を確認して同意したものを修正 |
| `/prisme-evolve` | コードを簡素化・高速化・発展させるアイデアと、類似製品 3〜5 件の機能・デザインの比較 |
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
