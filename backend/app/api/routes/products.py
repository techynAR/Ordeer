"""
app/api/routes/products.py
--------------------------
FastAPI router for the /products resource.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services import product_service
from app.services.product_service import ProductNotFoundError

router = APIRouter(prefix="/products", tags=["products"])


# ---------------------------------------------------------------------------
# POST /products
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product",
)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
) -> ProductResponse:
    return product_service.create_product(db, data)


# ---------------------------------------------------------------------------
# GET /products
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=list[ProductResponse],
    summary="List all products",
)
def list_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[ProductResponse]:
    return product_service.get_all_products(db, skip=skip, limit=limit)


# ---------------------------------------------------------------------------
# GET /products/{id}
# ---------------------------------------------------------------------------
@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get a product by id",
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
) -> ProductResponse:
    try:
        return product_service.get_product(db, product_id)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------------------------------------------------------------------------
# PUT /products/{id}
# ---------------------------------------------------------------------------
@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product",
)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
) -> ProductResponse:
    try:
        return product_service.update_product(db, product_id, data)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------------------------------------------------------------------------
# DELETE /products/{id}
# ---------------------------------------------------------------------------
@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        product_service.delete_product(db, product_id)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
