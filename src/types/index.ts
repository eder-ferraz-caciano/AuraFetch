export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS';
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'inherit' | 'oauth2';

export interface RequestHeader {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface EnvVar {
  id: string;
  key: string;
  value: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvVar[];
}

export interface AuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
  oauth2Config?: {
    clientId: string;
    clientSecret: string;
    accessTokenUrl: string;
    authUrl: string;
    scope: string;
    accessToken: string;
  };
}

export type RequestBodyType = 'json' | 'form-data' | 'urlencoded' | 'binary' | 'none' | 'graphql' | 'ws';

export interface FormDataField {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
  fileInfo?: { name: string; path: string };
  webFile?: File;   // Web mode only: File object do browser
}

export interface RequestModel {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  auth: AuthConfig;
  headers: RequestHeader[];
  queryParams: RequestHeader[];
  params: RequestHeader[];
  body: string;
  bodyType: RequestBodyType;
  formData: FormDataField[];
  graphqlQuery?: string;
  graphqlVariables?: string;
  wsMessages?: { id: string; type: 'sent' | 'received' | 'info' | 'error'; text: string; timestamp: number }[];
  binaryFile?: { name: string; path: string } | null;
  webBinaryFile?: File;  // Web mode only: File object do browser para binary upload
}

export interface SavedResponse {
  status: number;
  statusText: string;
  data: any;
  time: number;
  type?: 'json' | 'image' | 'pdf' | 'html' | 'text' | 'binary' | 'ws';
  contentType?: string;
  headers?: Record<string, string>;
}

export interface CollectionNode {
  id: string;
  name: string;
  type: 'folder' | 'request' | 'workspace';
  children?: CollectionNode[];
  request?: RequestModel;
  folderConfig?: {
    auth: AuthConfig;
    variables?: EnvVar[];
    setupScript?: string;
    headers?: RequestHeader[];
  };
  workspaceConfig?: {
    environments: Environment[];
    activeEnvironmentId: string | null;
    history: HistoryEntry[];
  };
  expanded?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'log' | 'error' | 'warn' | 'info' | 'success';
  message: string;
  data?: any;
}

// Legacy interface for migration
export interface LegacyWorkspace {
  id: string;
  name: string;
  collection: CollectionNode[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history?: HistoryEntry[];
}

export interface HistoryEntry {
  id: string;
  requestId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  timestamp: string;
  status: number;
}
