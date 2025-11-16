from fastapi.testclient import TestClient

def test_all_products(client: TestClient):
    products = client.get("/products")
    assert products.status_code == 200
    assert len(products.json()) > 0
