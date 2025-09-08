# 株式会社Festal メール配信システム

Microsoft Graph APIを使用したメール配信Webアプリケーション

## 🌟 特徴

- **完全無料**: Vercelで永続的に無料運用
- **環境構築不要**: ブラウザからアクセス
- **美しいUI**: モダンなレスポンシブデザイン
- **Excel/CSV対応**: 柔軟なカラム名対応
- **リアルタイム進捗**: 送信状況をリアルタイム表示

## 🚀 デプロイ方法

### 1. Vercelアカウント作成
1. [Vercel](https://vercel.com) にアクセス
2. GitHubアカウントでログイン（無料・クレジットカード不要）

### 2. GitHubリポジトリをVercelにデプロイ
1. Vercelダッシュボードで「New Project」
2. このリポジトリを選択
3. 「Deploy」をクリック

### 3. 環境変数設定
Vercelプロジェクト設定で以下を追加：

```
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
```

## 📋 使用方法

1. デプロイされたURLにアクセス
2. 送信者メールアドレス入力（@festal-inc.com）
3. Excel/CSVファイルをアップロード
4. プレビュー確認後、送信開始

## 📊 必要なファイル形式

### Excel/CSVファイルの必須カラム
- **宛先**: `宛先`, `email`, `メール`, `mail` 等
- **件名**: `件名`, `subject`, `タイトル` 等  
- **本文**: `本文`, `body`, `content`, `内容` 等

## 🔧 開発環境

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build
```

## 📝 技術スタック

- **フロントエンド**: Next.js 14, React, TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes, Microsoft Graph API
- **認証**: Azure AD (MSAL)
- **デプロイ**: Vercel (無料)

## 🎯 完全無料運用

- **Vercel**: 永続的に無料
- **GitHub**: 無料リポジトリ
- **Microsoft Graph API**: 既存のMicrosoft 365ライセンス使用

**総コスト: 0円** 🎉