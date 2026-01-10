from connection import get_database

if __name__ == "__main__":
    db = get_database()
    db.test_collection.insert_one({"message": "Hello Phoenix!"})
    result = db.test_collection.find_one()
    print(f"Test successful: {result}")
    db.test_collection.delete_many({})
    print("Database connection working!")


