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

セキュリティスコアは監査から生まれます：Claude Code で `/prisme-security` を実行します（ターミナルなら `claude "/prisme:prisme-security"`）。Claude がこのリポジトリのコードだけを読み、本当の脆弱性を確認し、誤検知は理由を添えて除外し、各脆弱性と修正方法を説明します。A–E の評価は prisme が計算します。ビューアのセキュリティページですべて確認できます。

## CLI

```bash
prisme setup                       # AI ツールにスキルを登録
prisme view                        # ビューアを開く：レベルを選び、3 つのスペースへ（マップは /map）
prisme view --no-ai                # Claude Code への質問なしで開く (API: docs/api.md)
prisme config language fr          # ドキュメントとインターフェースの言語を設定
prisme guide list                  # ガイド一覧を表示
prisme changes                     # 前回のスキャン以降の変更
prisme security                    # 自動のセキュリティ手がかり（評価は /prisme-security の監査が決める）
prisme security threats show       # /prisme-security が書いた脅威モデル（エレメントごとの STRIDE）と設計の質問
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
| `/prisme-security` | リポジトリのセキュリティ監査：Claude がコードを読み、本当の脆弱性だけを残して説明し、A–E の評価、脅威モデル（エレメントごとの STRIDE）と設計の質問を作成、同意したものを修正 |
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
