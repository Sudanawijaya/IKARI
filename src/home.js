// The existing language controls also translate the landing-page content.
function translateHome(language) {
  document.documentElement.lang = language;
  for (const element of document.querySelectorAll('[data-home-id]')) {
    element.textContent = element.dataset[language === 'en' ? 'homeEn' : 'homeId'];
  }
  document.getElementById('home-guide').setAttribute('aria-label', language === 'en' ? 'How it works' : 'Cara menggunakan');
}
for (const button of document.querySelectorAll('[data-ui-language]')) {
  button.addEventListener('click', () => translateHome(button.dataset.uiLanguage));
}
translateHome(document.querySelector('[data-ui-language].is-active')?.dataset.uiLanguage || 'id');
