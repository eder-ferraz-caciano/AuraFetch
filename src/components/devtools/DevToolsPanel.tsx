import React, { useState } from 'react';
import {
  QrCode,
  Barcode,
  Key,
  Zap,
  Hash,
  Clock,
  FileText,
  CreditCard,
  Shield,
  ArrowLeft,
  Globe,
  Activity,
  Printer,
  Camera,
  Columns2,
} from 'lucide-react';
import { QRCodeGenerator } from './tools/QRCodeGenerator';
import { BarcodeGenerator } from './tools/BarcodeGenerator';
import { UUIDGenerator } from './tools/UUIDGenerator';
import { Base64Tool } from './tools/Base64Tool';
import { JWTTool } from './tools/JWTTool';
import { CronHelper } from './tools/CronHelper';
import { RegexTester } from './tools/RegexTester';
import { CPFCNPJValidator } from './tools/CPFCNPJValidator';
import { HashCalculator } from './tools/HashCalculator';
import { NetworkTool } from './tools/NetworkTool';
import { PasswordGenerator } from './tools/PasswordGenerator';
import { JsonYamlTool } from './tools/JsonYamlTool';
import { UrlEncodeTool } from './tools/UrlEncodeTool';
import { LabelPrinterTool } from './tools/LabelPrinterTool';
import { RtspCameraTool } from './tools/RtspCameraTool';
import { TextDiffTool } from './tools/TextDiffTool';

interface ToolDefinition {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  component: React.ComponentType<{ onBack: () => void }>;
}

const tools: ToolDefinition[] = [
  {
    id: 'qrcode',
    label: 'Gerador QR Code',
    description: 'Gere códigos QR a partir de texto ou URL',
    icon: <QrCode size={24} />,
    component: QRCodeGenerator,
  },
  {
    id: 'barcode',
    label: 'Gerador Barcode',
    description: 'Crie códigos de barras em vários formatos',
    icon: <Barcode size={24} />,
    component: BarcodeGenerator,
  },
  {
    id: 'uuid',
    label: 'Gerador UUID',
    description: 'Gere UUIDs (v1, v4, v7) em lote',
    icon: <Key size={24} />,
    component: UUIDGenerator,
  },
  {
    id: 'base64',
    label: 'Base64',
    description: 'Codifique e decodifique Base64',
    icon: <Hash size={24} />,
    component: Base64Tool,
  },
  {
    id: 'jwt',
    label: 'JWT',
    description: 'Decodifique e gere tokens JWT',
    icon: <Shield size={24} />,
    component: JWTTool,
  },
  {
    id: 'cron',
    label: 'Expressão Cron',
    description: 'Decodifique e valide expressões cron',
    icon: <Clock size={24} />,
    component: CronHelper,
  },
  {
    id: 'regex',
    label: 'Validador Regex',
    description: 'Teste padrões de expressão regular',
    icon: <FileText size={24} />,
    component: RegexTester,
  },
  {
    id: 'cpfcnpj',
    label: 'Validador CPF/CNPJ',
    description: 'Valide e gere CPF ou CNPJ',
    icon: <CreditCard size={24} />,
    component: CPFCNPJValidator,
  },
  {
    id: 'hash',
    label: 'Gerador Hash',
    description: 'Gere hashes MD5 a partir de texto',
    icon: <Zap size={24} />,
    component: HashCalculator,
  },
  {
    id: 'password',
    label: 'Gerador Senha',
    description: 'Gere senhas aleatórias seguras',
    icon: <Key size={24} />,
    component: PasswordGenerator,
  },
  {
    id: 'jsonyaml',
    label: 'JSON \u2194 YAML',
    description: 'Converta entre JSON e YAML',
    icon: <FileText size={24} />,
    component: JsonYamlTool,
  },
  {
    id: 'urlencode',
    label: 'URL Codificação',
    description: 'Codifique e decodifique URLs',
    icon: <Globe size={24} />,
    component: UrlEncodeTool,
  },
  {
    id: 'network',
    label: 'Rede',
    description: 'Ping, IP Info e DNS Lookup',
    icon: <Activity size={24} />,
    component: NetworkTool,
  },
  {
    id: 'labelprinter',
    label: 'Impressora Etiquetas',
    description: 'Enviar ZPL/DPL para Zebra e Datamax',
    icon: <Printer size={24} />,
    component: LabelPrinterTool,
  },
  {
    id: 'rtsp',
    label: 'Testador RTSP',
    description: 'Testar câmeras e controlar PTZ',
    icon: <Camera size={24} />,
    component: RtspCameraTool,
  },
  {
    id: 'textdiff',
    label: 'Text Diff',
    description: 'Compare textos e veja as diferenças',
    icon: <Columns2 size={24} />,
    component: TextDiffTool,
  },
];

export const DevToolsPanel: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const handleToolClick = (toolId: string) => {
    setActiveTool(toolId);
  };

  const handleBack = () => {
    setActiveTool(null);
  };

  if (activeTool) {
    const tool = tools.find((t) => t.id === activeTool);
    if (!tool) return null;

    const ToolComponent = tool.component;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-panel)',
          }}
        >
          <button
            onClick={handleBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)',
            }}
          >
            {tool.label}
          </h2>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <ToolComponent onBack={handleBack} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-panel)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)',
          }}
        >
          Dev Tools
        </h2>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
        }}
      >
        <div
          className="devtools-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
          }}
        >
          {tools.map((tool) => (
            <button
              key={tool.id}
              className="devtools-card"
              onClick={() => handleToolClick(tool.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '20px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.backgroundColor = 'var(--bg-deep)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.backgroundColor = 'var(--bg-panel)';
              }}
            >
              <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {tool.icon}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  lineHeight: '1.2',
                }}
              >
                {tool.label}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.3',
                }}
              >
                {tool.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
