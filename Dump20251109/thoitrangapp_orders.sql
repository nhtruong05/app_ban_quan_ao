-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: donhattruongapp
-- ------------------------------------------------------
-- Server version	9.3.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `tongtien` decimal(12,2) DEFAULT '0.00',
  `trangthai` enum('Chờ xác nhận','Đã thanh toán','Đang giao','Hoàn thành','Hủy') COLLATE utf8mb4_unicode_ci DEFAULT 'Chờ xác nhận',
  `diachi_giaohang` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hoten` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sdt` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_order_user` (`user_id`),
  CONSTRAINT `fk_order_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (18,1,759000.00,'Chờ xác nhận','HCM','Đỗ Nhật Trường','0978914594','COD',NULL,'2025-10-26 14:36:29','2025-10-26 14:36:29'),(19,1,759000.00,'Đã thanh toán','HCM','Đỗ Nhật Trường','0978914594','COD','COD_CONFIRMED:19','2025-10-26 14:46:30','2025-10-26 14:46:30'),(22,1,319000.00,'Chờ xác nhận','HCM','Đỗ Nhật Trường','0978914594','VNPAY','VNPAY:22','2025-10-26 14:47:49','2025-10-26 14:47:49'),(25,1,319000.00,'Chờ xác nhận','HCM','Đỗ Nhật Trường','0978914594','VNPAY','VNPAY:25','2025-10-29 01:20:17','2025-11-09 11:24:10'),(27,1,366000.00,'Chờ xác nhận','HCM','Đỗ Nhật Trường','0978914594','VNPAY','VNPAY:27','2025-11-09 12:40:57','2025-11-09 12:40:57'),(28,1,366000.00,'Chờ xác nhận','HCM','Đỗ Nhật Trường','0978914594','GGPAY','GGPAY_PENDING:28','2025-11-09 12:41:26','2025-11-09 12:41:26'),(29,1,249000.00,'Chờ xác nhận','HCM','Đỗ Nhật Trường','0978914594','GGPAY','GGPAY_PENDING:29','2025-11-09 12:48:34','2025-11-09 12:48:34'),(30,1,249000.00,'Chờ xác nhận','HCM','Đỗ Nhật Trường','0978914594','VNPAY','VNPAY:30','2025-11-09 12:54:48','2025-11-09 12:54:48'),(31,1,249000.00,'Đã thanh toán','HCM','Đỗ Nhật Trường','0978914594','GGPAY','GGPAY_CONFIRMED:GGPAY_TOKEN_31','2025-11-09 12:55:26','2025-11-09 12:55:26'),(32,1,1897000.00,'Đã thanh toán','HCM','Đỗ Nhật Trường','0978914594','GGPAY','GGPAY_CONFIRMED:GGPAY_TOKEN_32','2025-11-09 13:37:45','2025-11-09 13:37:45');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-09 23:46:57
