from decimal import Decimal
import fastapi
from fastapi.testclient import TestClient

def test_all_products(client: TestClient):
    products = client.get("/products?group_name=Members")
    assert(products.status_code == 200)
    data = products.json()
    assert(len(data) == 2)
    by_ean = {}
    for product in data:
        by_ean[product['ean']] = product
    orval = by_ean['3606502246884']
    assert(Decimal(orval['price']) == Decimal('1.90'))
    # assert(orval['stock'] == 5)
    trappist = by_ean['5410908000029']
    assert(Decimal(trappist['price']) == Decimal('3.80'))
    # assert(trappist['stock'] == 7)
