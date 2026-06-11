import os
import sqlite3
from database import create_user, get_user_by_username, get_db_connection

def seed_data():
    print("Memulai seeding data...")
    
    # Hubungkan ke DB untuk memastikan tabel terbuat
    conn = get_db_connection()
    conn.close()
    
    # 1. Buat User Admin jika belum ada
    admin_user = get_user_by_username("admin")
    if not admin_user:
        # User pertama yang terbuat otomatis dapet role 'admin' berdasarkan logika di database.py
        user = create_user("admin", "admin123")
        if user:
            print(f"Berhasil membuat admin: username = admin, password = admin123 (role = {user['role']})")
        else:
            print("Gagal membuat admin.")
    else:
        print("User 'admin' sudah ada di database.")

    # 2. Buat User Biasa jika belum ada
    regular_user = get_user_by_username("user")
    if not regular_user:
        # User kedua dst otomatis dapet role 'user'
        user = create_user("user", "user123")
        if user:
            print(f"Berhasil membuat user biasa: username = user, password = user123 (role = {user['role']})")
        else:
            print("Gagal membuat user biasa.")
    else:
        print("User 'user' sudah ada di database.")

    print("Seeding selesai!")

if __name__ == "__main__":
    seed_data()
