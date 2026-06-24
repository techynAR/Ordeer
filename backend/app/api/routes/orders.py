"""
app/api/routes/orders.py
------------------------
FastAPI router for the /orders resource.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.order import (
    OrderCreate,
    OrderDetailResponse,
    OrderResponse,
    OrderSearchResult,
    OrderStatusUpdate,
)
from app.services import order_service
from app.services.order_service import (
    CustomerNotFoundError,
    EmptyOrderError,
    InsufficientStockError,
    OrderNotFoundError,
    ProductNotFoundError,
)

router = APIRouter(prefix="/orders", tags=["orders"])


# ---------------------------------------------------------------------------
# POST /orders
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an order",
)
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    try:
        return order_service.create_order(db, data)
    except EmptyOrderError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except InsufficientStockError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


# ---------------------------------------------------------------------------
# GET /orders/search
# ---------------------------------------------------------------------------
@router.get(
    "/search",
    response_model=list[OrderSearchResult],
    summary="Search orders by id or customer name",
)
def search_orders(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[OrderSearchResult]:
    results = order_service.search_orders(db, q, limit=limit)
    return [OrderSearchResult(**r) for r in results]


# ---------------------------------------------------------------------------
# GET /orders
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=list[OrderResponse],
    summary="List all orders",
)
def list_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[OrderResponse]:
    return order_service.get_all_orders(db, skip=skip, limit=limit)


# ---------------------------------------------------------------------------
# GET /orders/{id}
# ---------------------------------------------------------------------------
@router.get(
    "/{order_id}",
    response_model=OrderDetailResponse,
    summary="Get an order by id",
)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    try:
        return order_service.get_order(db, order_id)
    except OrderNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------------------------------------------------------------------------
# PATCH /orders/{id}/status
# ---------------------------------------------------------------------------
@router.patch(
    "/{order_id}/status",
    response_model=OrderDetailResponse,
    summary="Update order status",
)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    try:
        return order_service.update_order_status(db, order_id, data.status)
    except OrderNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------------------------------------------------------------------------
# DELETE /orders/{id}
# ---------------------------------------------------------------------------
@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an order",
)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        order_service.delete_order(db, order_id)
    except OrderNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
