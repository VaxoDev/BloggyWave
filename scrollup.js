function addBackToTopButton() {
    const button = document.createElement('button');
    button.innerHTML = '&uarr;';
    button.setAttribute('id', 'backToTop');
    document.body.appendChild(button);

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            button.classList.add('visible');
        } else {
            button.classList.remove('visible');
        }
    });

    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
