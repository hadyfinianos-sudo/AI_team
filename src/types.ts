export interface Article {
  id: string;
  title: string;
  content?: string;
  pdfUrl: string;
  videoUrl?: string;
  headerImage?: string;
  imagePosition?: 'top' | 'center' | 'bottom';
  categoryId: string;
  categoryIds?: string[];
  createdAt?: any;
  isDeleted?: boolean;
  deletedAt?: number;
}

export interface Category {
  id: string;
  title: string;
  articles: Article[];
}

export interface ExternalLink {
  id: string;
  title: string;
  url: string;
}

export interface SiteData {
  siteTitle: string;
  siteDescription: string;
  mainHeaderImage: string;
  siteBgColor?: string;
  primaryFontColor?: string;
  btnBgColor?: string;
  btnTextColor?: string;
  externalLinks?: ExternalLink[];
  categories: Category[];
  articles: Article[];
  admins: string[];
  version: string;
}
