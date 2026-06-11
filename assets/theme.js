// Shared theme handling for all tool pages.
// Load synchronously in <head> so the correct theme paints first.
document.documentElement.dataset.theme =
  localStorage.getItem('theme') ||
  (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
});
