'use client';

import { useState } from 'react';
import { Upload, Mail, Clock, FileText, Send, CheckCircle, AlertCircle } from 'lucide-react';

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
  const [isSending, setIsSending] = useState(false);
  const [emailData, setEmailData] = useState<EmailData[]>([]);
  const [preview, setPreview] = useState<EmailData[]>([]);
  const [results, setResults] = useState<SendResult[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'sending' | 'results'>('upload');
  const [error, setError] = useState('');

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

  const handleUpload = async () => {
    if (!file || !senderEmail) {
      setError('ファイルと送信者メールアドレスを入力してください');
      return;
    }

    if (!senderEmail.includes('@festal-inc.com')) {
      setError('Festalのメールアドレスを入力してください');
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
        setEmailData(result.data);
        setPreview(result.data.slice(0, 3));
        setCurrentStep('preview');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('ファイルのアップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!emailData.length) return;

    setIsSending(true);
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
        } catch (err) {
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
    } catch (err) {
      setError('メール送信中にエラーが発生しました');
    } finally {
      setIsSending(false);
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
            {currentStep === 'upload' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                  ファイルアップロード
                </h2>

                {/* 送信者メールアドレス */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    送信者メールアドレス
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="your.name@festal-inc.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 送信間隔 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    送信間隔
                  </label>
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
                    <p className="text-sm text-gray-500 mt-4">
                      対応形式: Excel (.xlsx, .xls), CSV (.csv)<br />
                      必須カラム: 宛先/email, 件名/subject, 本文/body
                    </p>
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
                  disabled={!file || !senderEmail || isUploading}
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