import { mlMaterials } from './learning/ml';
import { vibeMaterials } from './learning/vibe';
import { commonMaterials } from './learning/common';
export { hoursLabel } from './learning/types';
export type { Material, Resource, Track } from './learning/types';
export const materials = [...mlMaterials, ...vibeMaterials, ...commonMaterials];
export const courses = [
  { id: 'ml', title: 'Campus ML', description: 'От исследования таблицы до модели, которой можно обоснованно доверять.', slugs: ['scope-and-team', ...mlMaterials.map(m => m.slug), 'git-and-readme', 'demo'] },
  { id: 'vibe', title: 'Вайбкодинг', description: 'От понимания веба до проверенного приложения, собранного с помощью ИИ.', slugs: ['scope-and-team', ...vibeMaterials.map(m => m.slug), 'git-and-readme', 'demo'] },
] as const;
export function courseMaterials(id: string) {
  const course = courses.find(c => c.id === id)!;
  return course.slugs.map(slug => materials.find(m => m.slug === slug)!);
}
export function courseHours(id: string): [number, number] {
  return courseMaterials(id).reduce<[number, number]>((total, m) => [total[0] + m.hours[0], total[1] + m.hours[1]], [0, 0]);
}
