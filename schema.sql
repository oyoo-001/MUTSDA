-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS mutsda;
USE mutsda;

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    id INT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('member', 'deacon', 'elder', 'pastor', 'admin') DEFAULT 'member',
    profile_photo_url VARCHAR(255),
    phone VARCHAR(255),
    address VARCHAR(255),
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY email (email)
) ENGINE=InnoDB;

-- Sermons Table
CREATE TABLE IF NOT EXISTS Sermons (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    speaker VARCHAR(255),
    sermon_date DATETIME,
    category ENUM('sabbath', 'youth', 'revival', 'special_program', 'prayer_meeting', 'bible_study') DEFAULT 'sabbath',
    video_link VARCHAR(255),
    audio_url VARCHAR(255),
    notes_pdf_url VARCHAR(255),
    thumbnail_url VARCHAR(255),
    published TINYINT(1) DEFAULT 1,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Events Table
CREATE TABLE IF NOT EXISTS Events (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATETIME,
    end_date DATETIME,
    location VARCHAR(255),
    category ENUM('worship', 'youth', 'outreach', 'fellowship', 'seminar', 'camp_meeting', 'special') DEFAULT 'worship',
    rsvp_enabled TINYINT(1) DEFAULT 1,
    published TINYINT(1) DEFAULT 1,
    banner_image_url VARCHAR(255),
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Donations Table
CREATE TABLE IF NOT EXISTS Donations (
    id INT NOT NULL AUTO_INCREMENT,
    donor_name VARCHAR(255),
    donor_email VARCHAR(255),
    donation_type ENUM('tithe', 'offering', 'building_fund', 'mission_fund', 'custom') DEFAULT 'offering',
    amount DECIMAL(10, 2),
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(255),
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Announcements Table
CREATE TABLE IF NOT EXISTS Announcements (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    category ENUM('general', 'urgent', 'event', 'ministry', 'youth') DEFAULT 'general',
    pinned TINYINT(1) DEFAULT 0,
    published TINYINT(1) DEFAULT 1,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- MediaItems Table (Gallery)
CREATE TABLE IF NOT EXISTS MediaItems (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255),
    description TEXT,
    media_type ENUM('photo', 'video') DEFAULT 'photo',
    album VARCHAR(255),
    event_name VARCHAR(255),
    file_url VARCHAR(255) NOT NULL,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ContactMessages Table
CREATE TABLE IF NOT EXISTS ContactMessages (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    `read` TINYINT(1) DEFAULT 0,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ChatMessages Table (Live Chat)
CREATE TABLE IF NOT EXISTS ChatMessages (
    id INT NOT NULL AUTO_INCREMENT,
    message TEXT NOT NULL,
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    channel VARCHAR(50) DEFAULT 'general',
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB;