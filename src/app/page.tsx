'use client';

import { useState, useEffect } from 'react';
import { Upload, Mail, FileText, Send, CheckCircle, AlertCircle, Edit3, Eye, Shield, User, Users, Clock, LogOut } from 'lucide-react';
import { replaceTemplateVariables, createTemplateVariables, previewTemplate } from '@/lib/templateEngine';
import { PublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '@/lib/msalConfig';

// Phase 2: 宛先リストとテンプレートを分離
interface ContactData {
  email: string;
  name: string;
  company?: string;
  department?: string;
  position?: string;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

// Phase 1との互換性のため残す
interface EmailData {
  email: string;
  subject: string;
  body: string;
}

interface SendResult {
  index: number;
  email: string;
  success: boolean;
  message: string;
}

export default function Home() {
  const [senderEmail, setSenderEmail] = useState('');
  const [delay, setDelay] = useState(5);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [emailData, setEmailData] = useState<EmailData[]>([]);
  const [preview, setPreview] = useState<EmailData[]>([]);
  const [results, setResults] = useState<SendResult[]>([]);
  const [currentStep, setCurrentStep] = useState<'auth' | 'upload' | 'template' | 'preview' | 'sending' | 'results'>('auth');
  const [authenticatedUser, setAuthenticatedUser] = useState<AccountInfo | null>(null);
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [error, setError] = useState('');

  // Phase 2: 新しいステート
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({
    subject: '',
    body: ''
  });

  // MSAL初期化
  useEffect(() => {
    const initializeMsal = async () => {
      const instance = new PublicClientApplication(msalConfig);
      await instance.initialize();
      setMsalInstance(instance);
      
      // リダイレクト後の処理
      try {
        const response = await instance.handleRedirectPromise();
        if (response && response.account) {
          const account = response.account;
          if (account.username.includes('@festal-inc.com')) {
            setAuthenticatedUser(account);
            setSenderEmail(account.username);
            setCurrentStep('upload');
          } else {
            setError('Festalのメールアドレスでログインしてください');
            await instance.logoutRedirect();
          }
        }
      } catch (error) {
        console.error('Redirect handling failed:', error);
      }
      
      // 既存のアカウントをチェック
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        if (account.username.includes('@festal-inc.com')) {
          setAuthenticatedUser(account);
          setSenderEmail(account.username);
          setCurrentStep('upload');
        }
      }
    };
    
    initializeMsal();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
    }
  };

  const handleAuth = async () => {
    if (!msalInstance) {
      setError('認証システムの初期化中です。しばらくお待ちください。');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // リダイレクト方式を使用
      await msalInstance.loginRedirect(loginRequest);
      
    } catch (error: unknown) {
      console.error('Login failed:', error);
      if (error && typeof error === 'object' && 'errorCode' in error && error.errorCode === 'user_cancelled') {
        setError('ログインがキャンセルされました');
      } else {
        setError('Microsoftログインに失敗しました');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    if (!msalInstance) return;
    
    try {
      await msalInstance.logoutPopup();
      setAuthenticatedUser(null);
      setSenderEmail('');
      setCurrentStep('auth');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    if (!senderEmail || !authenticatedUser) {
      setError('認証が必要です。再度ログインしてください。');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('senderEmail', senderEmail);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // 宛先リストをセットしてテンプレート作成画面へ
        setContacts(result.data);
        setCurrentStep('template');
      } else {
        setError(result.error);
      }
    } catch {
      setError('ファイルのアップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!emailData.length) return;

    setCurrentStep('sending');
    const sendResults: SendResult[] = [];

    try {
      for (let i = 0; i < emailData.length; i++) {
        const email = emailData[i];
        
        try {
          const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              senderEmail,
              recipientEmail: email.email,
              subject: email.subject,
              body: email.body,
              authenticatedUserEmail: authenticatedUser?.username || senderEmail,
            }),
          });

          const result = await response.json();
          
          sendResults.push({
            index: i + 1,
            email: email.email,
            success: result.success,
            message: result.message || (result.success ? '送信成功' : '送信失敗'),
          });

          setResults([...sendResults]);

          // 遅延
          if (i < emailData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
          }
        } catch {
          sendResults.push({
            index: i + 1,
            email: email.email,
            success: false,
            message: 'ネットワークエラー',
          });
          setResults([...sendResults]);
        }
      }

      setCurrentStep('results');
    } catch {
      setError('メール送信中にエラーが発生しました');
    }
  };

  const reset = () => {
    setFile(null);
    setEmailData([]);
    setPreview([]);
    setResults([]);
    setCurrentStep('upload');
    setError('');
    setSenderEmail('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white rounded-full shadow-lg">
                <Mail className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              株式会社Festal
            </h1>
            <p className="text-xl text-gray-600">メール配信システム</p>
          </div>

          {/* メインコンテンツ */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {currentStep === 'auth' && (
              <div className="space-y-6">
                <div className="flex items-center mb-6">
                  <Shield className="h-7 w-7 text-blue-600 mr-3" />
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Microsoft認証
                  </h2>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-blue-600 mr-3">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-blue-800 font-medium">セキュリティ認証</p>
                      <p className="text-blue-700 text-sm">Microsoftアカウントで安全にログインします</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-yellow-600 mr-3">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-yellow-800 font-medium">重要</p>
                      <p className="text-yellow-700 text-sm">Festalのメールアドレス(@festal-inc.com)でのみログイン可能です</p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleAuth}
                  disabled={!msalInstance || isUploading}
                  className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Microsoftログイン中...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Microsoftでログイン
                    </div>
                  )}
                </button>
              </div>
            )}

            {currentStep === 'upload' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    ファイルアップロード
                  </h2>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-1" />
                      <strong>{authenticatedUser?.name}</strong> ({authenticatedUser?.username})
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center text-red-600 hover:text-red-800 text-sm"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      ログアウト
                    </button>
                  </div>
                </div>

                {/* 送信者情報（表示のみ） */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-green-600 mr-3">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-green-800 font-medium">送信者アカウント</p>
                      <p className="text-green-700 text-sm">
                        <strong>{authenticatedUser?.name}</strong> ({senderEmail})
                      </p>
                      <p className="text-green-600 text-xs mt-1">
                        認証済みアカウントから送信されます
                      </p>
                    </div>
                  </div>
                </div>

                {/* 送信間隔 */}
                <div>
                  <div className="flex items-center mb-2">
                    <Clock className="h-4 w-4 text-gray-600 mr-2" />
                    <label className="text-sm font-medium text-gray-700">
                      送信間隔
                    </label>
                  </div>
                  <select
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>1秒</option>
                    <option value={3}>3秒</option>
                    <option value={5}>5秒（推奨）</option>
                    <option value={10}>10秒</option>
                  </select>
                </div>

                {/* ファイルアップロード */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    メール配信リスト
                  </label>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
                  >
                    <Upload className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      ファイルをドラッグ&ドロップ
                    </p>
                    <p className="text-gray-500 mb-4">または</p>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      id="fileInput"
                    />
                    <label
                      htmlFor="fileInput"
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      ファイルを選択
                    </label>
                    <div className="text-sm text-gray-500 mt-6 text-left">
                      <div className="flex items-center justify-start mb-3">
                        <FileText className="h-4 w-4 mr-2" />
                        <strong>対応形式:</strong> Excel (.xlsx, .xls), CSV (.csv)
                      </div>
                      <div className="flex items-center justify-start mb-2">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        <strong>必須カラム:</strong>
                      </div>
                      <div className="ml-6 mb-3 text-gray-600">
                        • email, name
                      </div>
                      <div className="flex items-center justify-start mb-2">
                        <Users className="h-4 w-4 mr-2 text-blue-600" />
                        <strong>オプションカラム:</strong>
                      </div>
                      <div className="ml-6 mb-4 text-gray-600">
                        • company, department, position
                      </div>
                      <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded-md">
                        <div className="mb-1">※ Excel: 「宛先リスト」シートを優先読込</div>
                        <div className="mb-1">※ CSV: 任意のファイル名でアップロード可能</div>
                        <div>※ テンプレート作成画面で件名・本文を作成</div>
                      </div>
                    </div>
                  </div>
                  
                  {file && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-blue-800">
                        <FileText className="inline h-5 w-5 mr-2" />
                        {file.name}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!file || !authenticatedUser || isUploading}
                  className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      処理中...
                    </div>
                  ) : (
                    <>
                      <Upload className="inline h-5 w-5 mr-2" />
                      ファイルをアップロード
                    </>
                  )}
                </button>
              </div>
            )}

            {currentStep === 'template' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Edit3 className="h-7 w-7 text-blue-600 mr-3" />
                    <h2 className="text-2xl font-semibold text-gray-800">
                      メールテンプレート作成
                    </h2>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-1" />
                    宛先: <strong>{contacts.length}件</strong>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-blue-600 mr-3">
                      <Edit3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-blue-800 font-medium">テンプレート機能</p>
                      <p className="text-blue-700 text-sm">
                        変数を使って個別化されたメールを作成できます: {'{name}'}, {'{company}'}, {'{sender}'} など
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* テンプレート作成 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-700">テンプレート作成</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        件名
                      </label>
                      <input
                        type="text"
                        value={emailTemplate.subject}
                        onChange={(e) => setEmailTemplate({...emailTemplate, subject: e.target.value})}
                        placeholder="例: 【{'{company}'}】セミナーのご案内"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        本文
                      </label>
                      <textarea
                        value={emailTemplate.body}
                        onChange={(e) => setEmailTemplate({...emailTemplate, body: e.target.value})}
                        placeholder={`例:
{'{name}'}様

いつもお世話になっております。
{'{sender}'}です。

来月のセミナーについてご案内いたします...`}
                        rows={12}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">利用可能な変数:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>• {'{name}'} - 氏名</div>
                        <div>• {'{email}'} - メールアドレス</div>
                        <div>• {'{company}'} - 会社名</div>
                        <div>• {'{department}'} - 部署</div>
                        <div>• {'{position}'} - 役職</div>
                      </div>
                    </div>
                  </div>

                  {/* プレビュー */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-700">プレビュー</h3>
                    
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-300">
                        <div className="text-sm text-gray-600">件名:</div>
                        <div className="font-medium">
                          {emailTemplate.subject ? previewTemplate(emailTemplate.subject) : '件名を入力してください'}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-sm text-gray-600 mb-2">本文:</div>
                        <div className="whitespace-pre-wrap text-sm">
                          {emailTemplate.body ? previewTemplate(emailTemplate.body) : '本文を入力してください'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-yellow-600 mr-3">
                          <Eye className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-yellow-800 font-medium">プレビュー説明</p>
                          <p className="text-yellow-700 text-sm">
                            実際の送信時は各宛先の情報で変数が置換されます
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep('upload')}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    ← 戻る
                  </button>
                  <button
                    onClick={() => {
                      if (!emailTemplate.subject || !emailTemplate.body) {
                        setError('件名と本文を入力してください');
                        return;
                      }
                      
                      // テンプレートから実際のメールデータを生成
                      const generatedEmails = contacts.map(contact => {
                        const variables = createTemplateVariables(contact);
                        return {
                          email: contact.email,
                          subject: replaceTemplateVariables(emailTemplate.subject, variables),
                          body: replaceTemplateVariables(emailTemplate.body, variables)
                        };
                      });
                      
                      setEmailData(generatedEmails);
                      setPreview(generatedEmails.slice(0, 3));
                      setCurrentStep('preview');
                    }}
                    disabled={!emailTemplate.subject || !emailTemplate.body}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    プレビューを確認 →
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'preview' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    プレビュー
                  </h2>
                  <div className="text-lg font-medium text-blue-600">
                    総件数: {emailData.length}件
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <p className="text-green-800">ファイル読み込み完了</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-4">
                    プレビュー（最初の3件）
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">宛先</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">件名</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">本文</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((item, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 px-4 py-2">{item.email}</td>
                            <td className="border border-gray-300 px-4 py-2">{item.subject}</td>
                            <td className="border border-gray-300 px-4 py-2">
                              {item.body.length > 50 ? `${item.body.substring(0, 50)}...` : item.body}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
        </div>

                <div className="flex space-x-4">
                  <button
                    onClick={reset}
                    className="flex-1 py-3 px-6 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    戻る
                  </button>
                  <button
                    onClick={handleSend}
                    className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Send className="inline h-5 w-5 mr-2" />
                    メール送信開始
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'sending' && (
              <div className="text-center space-y-6">
                <h2 className="text-2xl font-semibold text-gray-800">
                  メール送信中
                </h2>
                
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                </div>
                
                <p className="text-gray-600">
                  進捗: {results.length} / {emailData.length} 件
                </p>

                {results.length > 0 && (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full border-collapse border border-gray-300 rounded-lg">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2">#</th>
                          <th className="border border-gray-300 px-4 py-2">宛先</th>
                          <th className="border border-gray-300 px-4 py-2">状態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((result) => (
                          <tr key={result.index}>
                            <td className="border border-gray-300 px-4 py-2">{result.index}</td>
                            <td className="border border-gray-300 px-4 py-2">{result.email}</td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className={`px-2 py-1 rounded-full text-sm ${
                                result.success 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {result.success ? '成功' : 'エラー'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'results' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-800">
                  送信結果
                </h2>

                <div className={`p-4 rounded-lg border ${
                  results.every(r => r.success) 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center mb-2">
                    {results.every(r => r.success) ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                    )}
                    <h3 className="font-medium">
                      {results.every(r => r.success) 
                        ? '全ての送信が完了しました！' 
                        : '送信が完了しました（一部エラーあり）'
                      }
                    </h3>
                  </div>
                  <p className="text-sm">
                    成功: {results.filter(r => r.success).length}件 / 
                    失敗: {results.filter(r => !r.success).length}件 / 
                    総計: {results.length}件
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full border-collapse border border-gray-300 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2">#</th>
                        <th className="border border-gray-300 px-4 py-2">宛先</th>
                        <th className="border border-gray-300 px-4 py-2">状態</th>
                        <th className="border border-gray-300 px-4 py-2">メッセージ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <tr key={result.index}>
                          <td className="border border-gray-300 px-4 py-2">{result.index}</td>
                          <td className="border border-gray-300 px-4 py-2">{result.email}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-sm ${
                              result.success 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {result.success ? '成功' : 'エラー'}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">
                            {result.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={reset}
                  className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  新しい配信を開始
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}