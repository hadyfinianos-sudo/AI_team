import { SiteData } from '../types';

export const mockSiteData: SiteData = {
  siteTitle: "منصة المقالات المعرفية",
  siteDescription: "منصة الدراسات والأبحاث الرقمية الموثقة",
  mainHeaderImage: "https://picsum.photos/seed/library/1600/400",
  siteBgColor: "#ffffff",
  primaryFontColor: "#000000",
  btnBgColor: "#000000",
  btnTextColor: "#ffffff",
  version: "v1.0.0",
  admins: ["hady.finianos@gmail.com"],
  articles: [],
  categories: [
    {
      id: "cat1",
      title: "التكنولوجيا والبرمجة",
      articles: [
        {
          id: "art1",
          title: "مستقبل الذكاء الاصطناعي في 2024",
          content: "دراسة تحليلية حول تطور الذكاء الاصطناعي التوليدي وتأثيره على سوق العمل العالمي.",
          pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          headerImage: "https://picsum.photos/seed/ai-tech/800/300",
          categoryId: "cat1"
        },
        {
          id: "art2",
          title: "أساسيات لغة البرمجة تايب سكريبت",
          content: "دليل شامل للمبتدئين حول استخدام Typescript في بناء تطبيقات الويب الحديثة.",
          pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          headerImage: "https://picsum.photos/seed/code/800/300",
          categoryId: "cat1"
        }
      ]
    },
    {
      id: "cat2",
      title: "العلوم والفيزياء",
      articles: [
        {
          id: "art3",
          title: "مدخل إلى ميكانيكا الكم",
          content: "شرح مبسط للمبادئ الأساسية للفيزياء الكمية وتجاربها الشهيرة.",
          pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          headerImage: "https://picsum.photos/seed/physics/800/300",
          categoryId: "cat2"
        }
      ]
    },
    {
      id: "cat3",
      title: "الأدب والفلسفة",
      articles: [
        {
          id: "art4",
          title: "تأثير الشعر الجاهلي على اللغة العربية",
          content: "بحث معمق في الجذور اللغوية والبلاغية التي أرساها الشعر الجاهلي.",
          pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          headerImage: "https://picsum.photos/seed/literature/800/300",
          categoryId: "cat3"
        }
      ]
    }
  ]
};
