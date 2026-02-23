// Carousel state
let currentImageIndex = 0;
const totalImages = 5;
let carouselInterval;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
    initFadeInAnimations();
    initSmoothScroll();
});

// Carousel functions
function initCarousel() {
    carouselInterval = setInterval(() => {
        nextImage();
    }, 4000);
}

function goToImage(index) {
    const images = document.querySelectorAll('.carousel-image');
    const indicators = document.querySelectorAll('.carousel-indicator');
    
    images[currentImageIndex].classList.remove('active');
    indicators[currentImageIndex].classList.remove('active');
    
    currentImageIndex = index;
    
    images[currentImageIndex].classList.add('active');
    indicators[currentImageIndex].classList.add('active');
    
    // Reset interval
    clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        nextImage();
    }, 4000);
}

function nextImage() {
    goToImage((currentImageIndex + 1) % totalImages);
}

function prevImage() {
    goToImage((currentImageIndex - 1 + totalImages) % totalImages);
}

// FAQ toggle
function toggleFaq(element) {
    const isActive = element.classList.contains('active');
    
    // Close all FAQs
    document.querySelectorAll('.faq-question').forEach(q => {
        q.classList.remove('active');
        q.nextElementSibling.style.maxHeight = '0';
    });
    
    // Open clicked one if it wasn't active
    if (!isActive) {
        element.classList.add('active');
        element.nextElementSibling.style.maxHeight = '150px';
    }
}

// Fade in animations
function initFadeInAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    });

    document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));
}

// Smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Voucher selection
function selectVoucher(amount, productName) {
    const voucherId = generateVoucherId();
    
    // Save to localStorage
    localStorage.setItem('selectedVoucher', JSON.stringify({
        amount,
        productName,
        voucherId
    }));
    
    // Navigate to form
    window.location.href = `payment.html?amount=${amount}&id=${voucherId}`;
}

// Generate voucher ID
function generateVoucherId() {
    return Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
}

// Utility: Format phone number
function formatPhone(value) {
    let numbers = value.replace(/\D/g, '');
    
    if (numbers.startsWith('972') && numbers.length >= 10 && numbers.length <= 12) {
        numbers = '0' + numbers.substring(3);
    }
    
    if (numbers.length === 9 && !numbers.startsWith('0')) {
        numbers = '0' + numbers;
    }
    
    if (numbers.length > 10) {
        numbers = numbers.substring(0, 10);
    }
    
    if (numbers.length === 10) {
        return numbers.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    
    return numbers;
}

// API base URL
const API_BASE = '/api';
