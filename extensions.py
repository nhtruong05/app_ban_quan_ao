from flask_mysqldb import MySQL
from flask_jwt_extended import JWTManager
from flask_cors import CORS

mysql = MySQL()
jwt = JWTManager()

def init_extensions(app):
    # CORS cho /api/*
    CORS(app,
         resources={r"/api/*": {"origins": "*"}},
         supports_credentials=False,
         expose_headers=["Authorization"],
         allow_headers=["Content-Type", "Authorization"])

    # Khởi tạo MySQL + JWT
    mysql.init_app(app)
    jwt.init_app(app)

    # Cho các blueprint khác truy cập
    app.config["MYSQL_EXT"] = mysql
