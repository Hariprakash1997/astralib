import Handlebars from 'handlebars';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

let registered = false;

export function registerEmailHelpers(): void {
  if (registered) return;
  registered = true;
  Handlebars.registerHelper('currency', (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return String(val ?? '');
    return `₹${num.toLocaleString('en-IN')}`;
  });

  Handlebars.registerHelper('formatDate', (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-IN', DATE_FORMAT_OPTIONS);
  });
}
