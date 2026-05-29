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
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `products_id` int NOT NULL AUTO_INCREMENT,
  `ten_san_pham` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gia_ban` decimal(12,2) NOT NULL,
  `loai` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mo_ta` text COLLATE utf8mb4_unicode_ci,
  `size` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chat_lieu` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gioi_tinh` enum('Nam','Nữ','Unisex') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hinh_anh` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trang_thai` enum('Đang bán','Ngừng bán') COLLATE utf8mb4_unicode_ci DEFAULT 'Đang bán',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`products_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (2,'Quần jean ống rộng màu be – Basic Wide Leg',200000.00,'Quần','Quần jean ống rộng màu be, lưng vừa, phom suông thoải mái. Tông be trung tính dễ phối, hợp đi học, đi làm lẫn dạo phố.','S','Cotton','Unisex','/static/uploads/10f24dpaw003-safari-quan-jean-nu-2-jpg-j78x.png','Đang bán','2025-10-26 10:18:41'),(3,'Quần jean ống rộng xanh nhạt – Wide Leg Denim',289000.00,'Quần','Quần jean ống rộng màu xanh nhạt, chất liệu denim 100% cotton bền chắc, phom suông hiện đại, dễ phối đồ cho cả nam và nữ.','S','Jean','Unisex','/static/uploads/10s25dpaw025-l-indigo-1-jpg-uclp.png','Đang bán','2025-10-26 10:31:34'),(4,'Áo thun trắng in họa tiết ngực trái – Graphic Tee White',159000.00,'Áo','Áo thun trắng unisex in họa tiết ngực trái trẻ trung, chất liệu cotton dày mịn, form suông dễ mặc, thoáng mát cho cả nam và nữ.','S','Cotton','Nam','/static/uploads/30d30810d89b4512a6f33f6fab69117f248a21f1.jpg','Đang bán','2025-10-26 10:32:38'),(5,'Áo thun trơn màu xanh navy – Basic Navy Tee',149000.00,'Áo','Áo thun trơn màu xanh navy form suông cơ bản, chất liệu cotton mềm mịn, thấm hút mồ hôi, dễ phối đồ cho cả nam và nữ.','S','Cotton','Unisex','/static/uploads/ao-thun-nam-tron-strength-contour-form-regular__9__09335e7f16a94728bb54f2f5587eb9dd_master.png','Đang bán','2025-10-26 10:38:50'),(6,'Áo thun đen in chữ “FACE EVERYDAY WITH A SMILE” – Positive Black Tee',169000.00,'Áo','Áo thun đen unisex in dòng chữ “FACE EVERYDAY WITH A SMILE” truyền cảm hứng tích cực, chất liệu cotton dày mịn, dễ mặc và dễ phối đồ.','S','Cotton','Unisex','/static/uploads/AP-2959N-0DE00-00.jpg','Đang bán','2025-10-26 10:39:45'),(7,'Quần tây đen dáng slim-fit – Elegant Black Pants',329000.00,'Quần','Quần tây đen dáng slim-fit thanh lịch, chất liệu polyester pha nhẹ, ít nhăn, dễ giặt ủi, phù hợp cho đi làm và sự kiện.','S','Polyester','Nam','/static/uploads/images.jpg','Đang bán','2025-10-26 10:41:05'),(8,'Quần jean đen slim-fit – Black Denim Basic',299000.00,'Quần','Quần jean đen slim-fit hiện đại, chất liệu denim cotton co giãn nhẹ, form ôm vừa tôn dáng, dễ phối đồ cho phong cách năng động và lịch sự.','M','Jean','Unisex','/static/uploads/quan-jeans-slimfit-basic-qj062-mau-den-18303.jpg','Đang bán','2025-10-26 10:41:57'),(9,'Quần jean xanh nhạt dáng suông – Light Blue Straight Jeans',309000.00,'Quần','Quần jean xanh nhạt dáng suông unisex, chất liệu denim cotton mềm, form suông trẻ trung, dễ phối đồ, phù hợp cả nam và nữ.','L','Jean','Unisex','/static/uploads/xanh_sang_truoc_ab921248a3de425fa7db3a41940c8ac6.png','Đang bán','2025-10-26 10:42:45'),(10,'Quần jean xanh nhạt ống rộng – Light Blue Wide Jeans',319000.00,'Quần','Quần jean xanh nhạt dáng ống rộng, chất liệu denim cotton mềm, form suông thoải mái, phù hợp mọi vóc dáng và dễ phối đồ.','XL','Jean','Unisex','/static/uploads/xcn1__1__d554c483d7a94905afcb92a1b0fb51d1_large.png','Đang bán','2025-10-26 10:43:33'),(11,'Áo thun tay dài nâu nhạt in chữ – Brown Script Long Sleeve Tee',759000.00,'Áo','Áo thun tay dài nâu nhạt in chữ phong cách Hàn Quốc, chất vải mềm mịn, nhẹ và thoáng, mang lại cảm giác thoải mái và tinh tế cho người mặc.','L','Cotton','Nữ','/static/uploads/z6157954984654_c35604de8282cb3183df3dbe5c1d20dd_f238d03e712c4f949598b45bec719b70.jpg','Đang bán','2025-10-26 10:44:32'),(12,'Áo thun unisex MELT đen basic',290000.00,'Áo','Áo thun unisex MELT màu đen thiết kế basic, form rộng thoải mái phù hợp cho cả nam và nữ. Chất liệu cotton cao cấp, mềm mịn, thoáng mát, thấm hút mồ hôi tốt giúp bạn dễ chịu cả ngày dài. Họa tiết chữ \"melt\" in giữa ngực tạo điểm nhấn đơn giản nhưng phong cách, dễ phối cùng quần jean, jogger hoặc short để tạo outfit năng động, thời trang. Phù hợp mặc đi học, đi chơi hoặc dạo phố.','L','Cotton','Unisex','/static/uploads/tai_xuong.jpg','Đang bán','2025-11-09 11:26:26'),(13,'Áo thun cờ đỏ sao vàng Việt Nam',500000.00,'Áo','Áo thun cờ đỏ sao vàng Việt Nam được thiết kế với tông đỏ nổi bật cùng ngôi sao vàng ở giữa ngực – biểu tượng tự hào dân tộc. Chất liệu cotton mềm mại, thoáng mát, thấm hút mồ hôi tốt, mang lại cảm giác dễ chịu khi mặc. Phù hợp cho các sự kiện, cổ vũ thể thao, hoặc các hoạt động ngoài trời, thể hiện tinh thần yêu nước và đoàn kết.','M','Cotton','Unisex','/static/uploads/ao-co-djo-sao-vang-viet-nam-1-10_638611468807420567.jpg','Đang bán','2025-11-09 11:36:29'),(14,'Áo thun unisex Life Can Be Tough',366000.00,'Áo','Áo thun unisex màu be với dòng chữ \"Life can be tough so you are\" mang thông điệp tích cực, cổ vũ tinh thần mạnh mẽ. Form rộng thoải mái, phù hợp cho mọi giới tính và phong cách. Chất liệu cotton cao cấp, co giãn nhẹ, thấm hút mồ hôi tốt giúp bạn luôn thoải mái suốt ngày dài. Dễ phối cùng quần jean, kaki hoặc short, phù hợp mặc đi học, đi chơi hay dạo phố.','XL','Cotton','Unisex','/static/uploads/nau-fn2_a41dad56d77540a0abd4ed90e5608bb7_large.png','Đang bán','2025-11-09 11:44:07'),(15,'Áo thun hoa “Mai Phương”',249000.00,'Áo','Áo thun trắng in họa tiết hoa “Mai Phương” mang phong cách nhẹ nhàng và thanh lịch. Thiết kế tinh tế với hai bông hoa tông màu pastel và chữ ký mềm mại tạo điểm nhấn riêng biệt. Chất liệu cotton cao cấp, mềm mịn, thoáng mát, thấm hút mồ hôi tốt, mang lại cảm giác dễ chịu suốt cả ngày. Phù hợp để mặc đi chơi, đi học, dạo phố hoặc làm quà tặng ý nghĩa cho người thân và bạn bè.','L','Cotton','Unisex','/static/uploads/sp91-1.jpg','Đang bán','2025-11-09 11:49:00');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
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
