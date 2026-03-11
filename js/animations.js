// ============================================
// ANIMATIONS.JS - Animation Utilities
// ============================================

/**
 * Confetti celebration animation
 */
export function celebrateWithConfetti(duration = 3000) {
    const colors = ['#6c5ce7', '#a29bfe', '#00f3ff', '#2ecc71', '#ff6b81', '#ffc107'];
    const confettiCount = 50;
    const container = document.createElement('div');
    container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
  `;
    document.body.appendChild(container);

    for (let i = 0; i < confettiCount; i++) {
        createConfettiPiece(container, colors);
    }

    setTimeout(() => {
        container.remove();
    }, duration);
}

function createConfettiPiece(container, colors) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const animationDuration = 2 + Math.random() * 2;
    const size = 5 + Math.random() * 5;
    const rotation = Math.random() * 360;
    const delay = Math.random() * 0.5;

    confetti.style.cssText = `
    position: absolute;
    left: ${left}%;
    top: -10%;
    width: ${size}px;
    height: ${size}px;
    background: ${color};
    opacity: 0.8;
    transform: rotate(${rotation}deg);
    animation: confettiFall ${animationDuration}s ease-out ${delay}s forwards;
  `;

    container.appendChild(confetti);
}

// Add confetti animation to document
if (!document.getElementById('confetti-styles')) {
    const style = document.createElement('style');
    style.id = 'confetti-styles';
    style.textContent = `
    @keyframes confettiFall {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
  `;
    document.head.appendChild(style);
}

/**
 * Scroll reveal animation
 */
export function initScrollReveal() {
    const elements = document.querySelectorAll('.scroll-reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => observer.observe(el));
}

/**
 * Animated counter
 */
export function animateCounter(element, target, duration = 1000, suffix = '') {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current) + suffix;
    }, 16);
}

/**
 * Toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} notification-enter`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-message">
        <div class="toast-text">${message}</div>
      </div>
      <button class="toast-close">×</button>
    </div>
  `;

    document.body.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => removeToast(toast);

    setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
    toast.classList.remove('notification-enter');
    toast.classList.add('notification-exit');
    setTimeout(() => toast.remove(), 400);
}

/**
 * Loading spinner
 */
export function showLoading(container) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.id = 'app-spinner';
    container.appendChild(spinner);
    return spinner;
}

export function hideLoading() {
    const spinner = document.getElementById('app-spinner');
    if (spinner) spinner.remove();
}

/**
 * Stagger animation for list items
 */
export function staggerAnimation(elements, animationClass = 'animate-fade-in-up') {
    elements.forEach((el, index) => {
        el.classList.add(animationClass);
        el.style.animationDelay = `${index * 0.1}s`;
    });
}

/**
 * Progress bar animation
 */
export function animateProgress(element, targetPercent, duration = 1000) {
    element.style.width = '0%';
    setTimeout(() => {
        element.style.transition = `width ${duration}ms ease-out`;
        element.style.width = targetPercent + '%';
    }, 50);
}

/**
 * Circular progress ring
 */
export function updateProgressRing(svg, percent) {
    const circle = svg.querySelector('.progress-ring-progress');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
}

/**
 * Pulse animation on element
 */
export function pulseElement(element) {
    element.classList.add('animate-pulse');
    setTimeout(() => {
        element.classList.remove('animate-pulse');
    }, 2000);
}
