FROM php:8.4-cli
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    libpng-dev \
    libjpeg62-turbo-dev \
    libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo pdo_mysql zip gd

# 🎨 ไฟล์พื้นหลังหน้า login (รูป/วิดีโอ) ต้องอัปโหลดได้เกิน 2MB เดิมของ PHP — วิดีโอสูงสุด 50MB (ดู LoginBackgroundController)
RUN { echo "upload_max_filesize=64M"; echo "post_max_size=72M"; echo "memory_limit=256M"; } > /usr/local/etc/php/conf.d/uploads.ini