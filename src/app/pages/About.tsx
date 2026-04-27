import type { CmsBlock } from '../cms/content';
import { CmsPageRenderer } from '../components/CmsPageRenderer';

const fallbackBlocks: CmsBlock[] = [
  {
    type: 'sectionTitle',
    text: 'О нас'
  },
  {
    type: 'text',
    title: 'Sara Flowers',
    body:
      'Мы создаем авторские букеты и композиции из свежих цветов.\n' +
      'Наша команда собирает заказы вручную и бережно доставляет их по Москве и области.'
  },
  {
    type: 'text',
    title: 'Почему нам доверяют',
    body:
      '• Только свежие цветы от проверенных поставщиков\n' +
      '• Фото букета перед отправкой\n' +
      '• Внимание к деталям и пунктуальная доставка'
  }
];

export function About() {
  return <CmsPageRenderer slug="about" fallbackTitle="О нас" fallbackBlocks={fallbackBlocks} />;
}
