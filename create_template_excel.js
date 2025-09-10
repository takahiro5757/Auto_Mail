const XLSX = require('xlsx');

// 新しいワークブックを作成
const workbook = XLSX.utils.book_new();

// 使い方シート
const usageData = [
  ['株式会社Festal メール配信システム - テンプレート機能'],
  [''],
  ['■ 使い方'],
  ['1. 「宛先リスト」シートに送信先の情報を入力してください'],
  ['2. システムにファイルをアップロードします'],
  ['3. テンプレート作成画面で件名・本文を作成します'],
  ['4. 変数を使って個別化されたメールを送信できます'],
  [''],
  ['■ 利用可能な変数'],
  ['• {name} - 氏名'],
  ['• {email} - メールアドレス'],
  ['• {company} - 会社名'],
  ['• {department} - 部署名'],
  ['• {position} - 役職'],
  [''],
  ['■ テンプレート例'],
  ['件名: 【{company}】{department}の{position}様へのご案内'],
  [''],
  ['本文:'],
  ['{name}様'],
  [''],
  ['いつもお世話になっております。'],
  [''],
  ['{company}の{department}で{position}としてご活躍の{name}様に、'],
  ['重要なお知らせをお送りいたします。'],
  [''],
  ['■ 対象部署: {department}'],
  ['■ 対象役職: {position}'],
  [''],
  ['各部署・役職に応じた内容でお送りしています。'],
  [''],
  ['何かご不明な点がございましたら、'],
  ['お気軽にお問い合わせください。'],
  [''],
  ['よろしくお願いいたします。'],
  [''],
  ['■ 注意事項'],
  ['• 必須項目: email, name'],
  ['• オプション項目: company, department, position'],
  ['• 送信者名や日付は直接本文に記載してください'],
  ['• 変数が空の場合は空文字に置換されます']
];

const usageSheet = XLSX.utils.aoa_to_sheet(usageData);

// 宛先リストシート
const contactsData = [
  ['email', 'name', 'company', 'department', 'position'],
  ['sample1@example.com', 'サンプル太郎', 'サンプル株式会社', '営業部', '営業マネージャー'],
  ['sample2@example.com', 'サンプル花子', 'サンプル株式会社', '開発部', 'エンジニア'],
  ['sample3@example.com', 'サンプル次郎', 'サンプル株式会社', 'マーケティング部', 'マーケティング担当'],
  ['sample4@example.com', 'サンプル三郎', 'サンプル株式会社', '人事部', '人事担当'],
  ['sample5@example.com', 'サンプル四郎', 'サンプル株式会社', '総務部', '総務担当'],
  ['', '', '', '', ''],
  ['※ 上記はサンプルデータです。実際のデータに置き換えてください。'],
  ['※ email と name は必須項目です。'],
  ['※ company, department, position は任意項目です。']
];

const contactsSheet = XLSX.utils.aoa_to_sheet(contactsData);

// シートをワークブックに追加
XLSX.utils.book_append_sheet(workbook, usageSheet, '使い方');
XLSX.utils.book_append_sheet(workbook, contactsSheet, '宛先リスト');

// Excelファイルとして保存
XLSX.writeFile(workbook, 'メール配信テンプレート.xlsx');

console.log('✅ テンプレートファイル「メール配信テンプレート.xlsx」を作成しました！');
console.log('📋 シート構成:');
console.log('  - 使い方: システムの使用方法とテンプレート例');
console.log('  - 宛先リスト: 実際のデータを入力するシート');
console.log('🚀 システムは「宛先リスト」シートを自動で読み込みます');
